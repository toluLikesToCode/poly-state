# Security Policy

## Supported Versions

We provide security updates for the following versions of Universal Store:

| Version | Supported |
| ------- | --------- |
| 1.x.x   | ✅        |
| 0.x.x   | ❌        |

## Reporting a Vulnerability

If you discover a security vulnerability in Universal Store, please report it responsibly:

### How to Report

1. **Email**: Send details to [tolu.adegbehingbe@icloud.com] (or create a private GitHub issue)
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

### What to Expect

- **Initial Response**: Within 48 hours
- **Status Updates**: Every 7 days until resolved
- **Resolution Timeline**: We aim to resolve critical issues within 30 days

### Disclosure Policy

- We request 90 days to investigate and mitigate issues before public disclosure
- Credit will be given to reporters unless anonymity is requested
- We will coordinate disclosure timing with you

## Security Best Practices

When using Universal Store:

### Data Handling

- Never store sensitive data (passwords, tokens, PII) in the store without encryption
- Validate all data before storing it in the store
- Be cautious with serialization/deserialization of store state

### React Integration

- Sanitize any user input before storing in state
- Be aware of potential XSS vectors when rendering store data
- Use React's built-in protections and don't bypass them

### Storage Plugins

- Only use trusted storage adapters
- Validate stored data when loading from persistence
- Consider encryption for sensitive data in persistent storage

## Dependencies

We regularly audit our dependencies for security vulnerabilities:

- **Immer**: Used for immutable state updates
- **React** (peer dependency): Optional for React integration

## Reporting Non-Security Issues

For non-security related bugs and issues, please use our
[GitHub Issues](https://github.com/yourusername/universal-store/issues).

## Contact

For any security-related questions, contact: [tolu.adegbehingbe@icloud.com]
