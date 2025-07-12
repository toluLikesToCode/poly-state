# Contributing to Poly State

Thank you for your interest in contributing to Poly State! This document provides guidelines and
information for contributors.

## Development Setup

1. **Fork and Clone**

   ```bash
   git clone https://github.com/yourusername/poly-state.git
   cd poly-state
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Build the Package**

   ```bash
   npm run build
   ```

4. **Run Tests**

   ```bash
   npm run test
   ```

## Development Workflow

### Project Structure

- `src/core/` - Core store implementation (framework agnostic)
- `src/react/` - React-specific hooks and components
- `src/plugins/` - Plugin implementations
- `test/` - Test files
- `examples/` - Usage examples

### Code Style

We use ESLint and Prettier for code formatting:

```bash
npm run lint        # Check for linting issues
npm run format      # Format code with Prettier
```

### Testing

- **Run all tests**: `npm run test`
- **Run core tests**: `npm run test:core`
- **Run React tests**: `npm run test:react`
- **Watch mode**: `npm run test:watch`
- **Coverage**: `npm run test:coverage`

### Building

- **Development build**: `npm run dev` (watch mode)
- **Production build**: `npm run build`
- **Clean build artifacts**: `npm run clean`

## Contribution Guidelines

### 1. Architecture Principles

- **Dual Export System**: Maintain separate entry points for vanilla TypeScript and React
- **Type Safety**: All public APIs must have comprehensive TypeScript definitions
- **Immutability**: Use immutable state update patterns
- **Backward Compatibility**: Avoid breaking changes when possible

### 2. Code Standards

- Use TypeScript for all source code
- Follow the existing code style (enforced by ESLint/Prettier)
- Write comprehensive JSDoc comments for public APIs
- Include unit tests for new features
- Ensure both vanilla and React usage scenarios are tested

### 3. Commit Guidelines

We follow conventional commit format:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions/improvements
- `chore:` - Maintenance tasks

Example:

```md
feat(core): add new selector optimization feature fix(react): resolve hook dependency issue docs:
update API documentation
```

### 4. Pull Request Process

1. **Create a feature branch** from `main`
2. **Implement your changes** following the guidelines above
3. **Add/update tests** to cover your changes
4. **Update documentation** if needed
5. **Ensure all tests pass** and code is properly formatted
6. **Submit a pull request** with a clear description

### 5. Testing Requirements

- New features must include unit tests
- Bug fixes should include regression tests
- Tests should cover both vanilla TypeScript and React usage
- Maintain or improve code coverage

### 6. Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for new public APIs
- Include examples for new features
- Update type definitions

## Development Commands

```bash
# Development
npm run dev           # Build in watch mode
npm run build         # Production build
npm run clean         # Clean build artifacts

# Testing
npm run test          # Run all tests
npm run test:run      # Run tests once
npm run test:watch    # Run tests in watch mode
npm run test:ui       # Run tests with UI
npm run test:coverage # Run tests with coverage

# Code Quality
npm run lint          # Check linting
npm run format        # Format code
```

## Plugin Development

When creating new plugins:

1. Place plugin code in `src/plugins/`
2. Export from `src/plugins/index.ts`
3. Include comprehensive tests
4. Document plugin API and usage
5. Ensure plugin works with both vanilla and React usage

## Questions and Support

If you have questions about contributing:

1. Check existing issues and discussions
2. Create a new issue for bugs or feature requests
3. Start a discussion for questions or ideas

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a welcoming environment for all contributors

Thank you for contributing to Poly State!
