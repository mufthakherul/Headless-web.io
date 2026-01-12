/**
 * WebSocket Support for Live Mode
 * Provides real-time bidirectional communication for interactive browsing
 */

const WebSocket = require('ws');
const logger = require('./logger');
const liveManager = require('./liveMode');

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // sessionId -> ws connection
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws/live'
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    logger.info('WebSocket server initialized');
  }

  handleConnection(ws, req) {
    const sessionId = this.extractSessionId(req);
    
    if (!sessionId) {
      ws.close(1008, 'Missing session ID');
      return;
    }

    logger.info('WebSocket client connected', { sessionId });
    this.clients.set(sessionId, ws);

    // Send welcome message
    this.sendMessage(ws, {
      type: 'connected',
      sessionId,
      timestamp: Date.now()
    });

    // Set up message handler
    ws.on('message', async (data) => {
      await this.handleMessage(ws, sessionId, data);
    });

    // Handle disconnection
    ws.on('close', () => {
      logger.info('WebSocket client disconnected', { sessionId });
      this.clients.delete(sessionId);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', { sessionId, error: error.message });
      this.clients.delete(sessionId);
    });

    // Start frame streaming
    this.startFrameStreaming(sessionId);
  }

  extractSessionId(req) {
    const url = new URL(req.url, 'http://localhost');
    return url.searchParams.get('sid');
  }

  async handleMessage(ws, sessionId, data) {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'input':
          await this.handleInput(sessionId, message.event);
          break;

        case 'navigate':
          await this.handleNavigate(sessionId, message.url);
          break;

        case 'requestFrame':
          await this.sendFrame(sessionId);
          break;

        case 'ping':
          this.sendMessage(ws, { type: 'pong', timestamp: Date.now() });
          break;

        default:
          logger.warn('Unknown WebSocket message type', { 
            sessionId, 
            type: message.type 
          });
      }
    } catch (error) {
      logger.error('Failed to handle WebSocket message', { 
        sessionId, 
        error: error.message 
      });
      this.sendMessage(ws, {
        type: 'error',
        message: error.message
      });
    }
  }

  async handleInput(sessionId, event) {
    try {
      await liveManager.sendInput(sessionId, event);
      
      // Send frame update after input
      setTimeout(() => {
        this.sendFrame(sessionId);
      }, 100);
    } catch (error) {
      logger.error('Failed to handle input', { sessionId, error: error.message });
    }
  }

  async handleNavigate(sessionId, url) {
    try {
      await liveManager.navigate(sessionId, url);
      
      const ws = this.clients.get(sessionId);
      if (ws) {
        this.sendMessage(ws, {
          type: 'navigated',
          url,
          timestamp: Date.now()
        });
      }

      // Send frame after navigation
      setTimeout(() => {
        this.sendFrame(sessionId);
      }, 1000);
    } catch (error) {
      logger.error('Failed to handle navigate', { sessionId, error: error.message });
    }
  }

  async sendFrame(sessionId) {
    const ws = this.clients.get(sessionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const frameData = await liveManager.captureFrame(sessionId, 'png');
      const pageInfo = await liveManager.getPageInfo(sessionId);

      this.sendMessage(ws, {
        type: 'frame',
        image: frameData.image.toString('base64'),
        format: frameData.format,
        timestamp: frameData.timestamp,
        pageInfo
      });
    } catch (error) {
      logger.error('Failed to send frame', { sessionId, error: error.message });
    }
  }

  startFrameStreaming(sessionId) {
    // Stream frames at 2 FPS (every 500ms)
    let errorCount = 0;
    const maxErrors = 5;
    
    const intervalId = setInterval(async () => {
      const ws = this.clients.get(sessionId);
      
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        clearInterval(intervalId);
        return;
      }

      try {
        await this.sendFrame(sessionId);
        errorCount = 0; // Reset on success
      } catch (error) {
        errorCount++;
        logger.error('Frame streaming error', { sessionId, errorCount, error: error.message });
        
        // Stop streaming after too many errors
        if (errorCount >= maxErrors) {
          logger.error('Stopping frame streaming due to repeated errors', { sessionId });
          clearInterval(intervalId);
          this.sendMessage(ws, {
            type: 'error',
            message: 'Frame streaming stopped due to errors'
          });
        }
      }
    }, 500);

    // Store interval ID for cleanup
    const ws = this.clients.get(sessionId);
    if (ws) {
      ws._frameInterval = intervalId;
    }
  }

  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcast(message) {
    for (const ws of this.clients.values()) {
      this.sendMessage(ws, message);
    }
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
      wsServerActive: !!this.wss
    };
  }

  shutdown() {
    logger.info('Shutting down WebSocket server');
    
    // Close all client connections
    for (const [sessionId, ws] of this.clients.entries()) {
      if (ws._frameInterval) {
        clearInterval(ws._frameInterval);
      }
      ws.close(1001, 'Server shutting down');
    }

    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}

// Singleton instance
const wsManager = new WebSocketManager();

module.exports = wsManager;
