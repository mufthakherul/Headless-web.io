# Contributing to Headless-web

Thank you for your interest in contributing to Headless-web! This document provides guidelines and instructions for contributing.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Headless-web.git
   cd Headless-web
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Start the development server**:
   ```bash
   npm start
   ```

## Development Workflow

1. **Create a new branch** for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Test your changes** thoroughly:
   - Ensure the server starts without errors
   - Test the UI in multiple browsers if applicable
   - Verify your changes don't break existing functionality

4. **Commit your changes** with clear, descriptive messages:
   ```bash
   git commit -m "Add: Brief description of your changes"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** on GitHub

## Coding Standards

- Use consistent indentation (2 spaces)
- Write clear, self-documenting code
- Add comments for complex logic
- Follow existing code style and conventions
- Keep functions small and focused

## Project Structure

```
Headless-web/
├── .github/          # GitHub Actions workflows
├── docs/             # Documentation files
├── public/           # Frontend static files
├── server.js         # Express server
├── package.json      # Dependencies and scripts
└── README.md         # Project overview
```

## Types of Contributions

### 🐛 Bug Reports
- Use GitHub Issues
- Include steps to reproduce
- Describe expected vs actual behavior
- Include system/environment details

### ✨ Feature Requests
- Use GitHub Issues
- Describe the use case
- Explain why this feature would be beneficial
- Consider discussing before implementing large features

### 💻 Code Contributions
We welcome contributions in these areas:

**High Priority:**
- Security implementations (SSRF protection, rate limiting)
- Basic proxy functionality (Fast mode)
- Content extraction (Reader mode)
- Error handling and logging

**Medium Priority:**
- Optimization layer (Fast+ mode)
- Browser automation integration (Live mode)
- Session management improvements
- Testing infrastructure

**Low Priority (but welcome!):**
- UI enhancements
- Documentation improvements
- Additional mode implementations
- Performance optimizations

### 📚 Documentation
- Fix typos or unclear explanations
- Add examples and use cases
- Improve API documentation
- Create tutorials or guides

## Security

If you discover a security vulnerability, please **DO NOT** open a public issue. Instead:
1. Email the maintainers directly (check README for contact info)
2. Provide detailed information about the vulnerability
3. Allow time for the issue to be addressed before public disclosure

## Important Security Notes

When implementing features:
- **Always** validate and sanitize user input
- **Never** trust URLs without SSRF checks
- Implement rate limiting for public endpoints
- Use secure session management
- Follow principle of least privilege

## Pull Request Guidelines

**Before submitting:**
- [ ] Code follows project style
- [ ] Changes are tested
- [ ] Documentation is updated if needed
- [ ] Commit messages are clear
- [ ] No unnecessary files included

**PR Description should include:**
- What changes were made
- Why these changes were needed
- How to test the changes
- Any breaking changes or migrations needed

## Questions?

Feel free to:
- Open an issue for questions
- Check existing documentation in `/docs`
- Review the README.md

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help create a welcoming environment
- Follow GitHub's Community Guidelines

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Headless-web! 🚀
