# CI/CD Pipeline Documentation

This document describes the comprehensive CI/CD pipeline setup for Poly State.

## Overview

Our CI/CD pipeline ensures code quality through multiple automated workflows that validate both unit
functionality and real browser integration.

## Workflow Structure

### 1. **CI Workflow** (`.github/workflows/ci.yml`)

Triggered on push/PR to `main` or `develop` branches.

#### **Unit Tests Job**

- ✅ Linting and type checking
- ✅ Unit tests in jsdom environment
- ✅ Coverage reporting to Codecov
- ⚡ Fast feedback (~2-3 minutes)

#### **Browser Tests Job**

- ✅ Real Chromium browser testing
- ✅ Storage system validation (localStorage, sessionStorage, cookies)
- ✅ React integration in real DOM
- ✅ Cross-tab synchronization testing
- 🌐 Authentic browser behavior validation

#### **Build Job**

- ✅ Production build verification
- ✅ Artifact upload for deployment
- 🔄 Runs after both test jobs pass

### 2. **PR Validation Workflow** (`.github/workflows/pr-validation.yml`)

Enhanced validation for pull requests with:

- 🚫 Draft PR detection and skipping
- 📦 Package.json change detection and lockfile verification
- 🔍 Security scanning with CodeQL
- 💬 Automated PR comments with test results and coverage
- ⚡ Concurrency control to cancel outdated runs

### 3. **Test Matrix Workflow** (`.github/workflows/test-matrix.yml`)

Weekly comprehensive testing across:

- **Node.js versions**: 18.x, 20.x, 22.x
- **Operating systems**: Ubuntu, macOS, Windows\*
- **Browsers**: Chromium (real browser testing)

\*Windows runs unit tests only due to Playwright complexity.

### 4. **Release Workflow** (`.github/workflows/release.yml`)

Automated releases with comprehensive testing:

- ✅ Full test suite validation (unit + browser)
- 📦 Production build
- 🚀 Automated GitHub Packages publishing
- 📋 Enhanced release notes with testing coverage information

### 5. **Auto-merge Dependabot** (`.github/workflows/auto-merge-dependabot.yml`)

Automated dependency updates with safety checks:

- 🤖 Auto-approval for passing Dependabot PRs
- ✅ Full test validation before merge
- 🔄 Automatic squash merging
- 💬 Status notifications

## Dependencies Management

### **Dependabot Configuration** (`.github/dependabot.yml`)

- 📅 Weekly dependency updates
- 📦 Grouped updates by category (vitest, playwright, testing, etc.)
- 🔢 Limited PR count to prevent noise
- 🔄 Auto-rebasing enabled

### **Dependency Categories**

```yaml
vitest: # Vitest and @vitest/* packages
playwright: # Playwright ecosystem
testing: # Testing libraries
build-tools: # Rollup, TypeScript, etc.
linting: # ESLint, Prettier
```

## Testing Strategy Integration

### **Dual Testing Approach**

1. **🧪 Unit Tests** (Fast Feedback Loop)
   - Environment: jsdom
   - Purpose: Core logic, React hooks, business logic
   - Speed: ~2-3 seconds locally
   - Coverage: Comprehensive with thresholds

2. **🌐 Browser Tests** (Real Integration)
   - Environment: Real Chromium via Playwright
   - Purpose: Storage systems, cross-tab sync, real DOM
   - Speed: ~15-20 seconds in CI
   - Coverage: Critical browser-specific functionality

### **Coverage Reporting**

- Codecov integration for coverage tracking
- Threshold enforcement: 80% minimum
- PR coverage diff reporting
- Historical coverage trends

## Environment Configuration

### **Required Secrets**

- `GITHUB_TOKEN` (automatic) - For publishing and releases
- `CODECOV_TOKEN` (optional) - For enhanced coverage reporting

### **CI Environment Variables**

```yaml
NODE_VERSION: '18.x'
PLAYWRIGHT_BROWSERS: 'chromium'
COVERAGE_THRESHOLD: 80
```

## Performance Optimizations

### **Caching Strategy**

- ✅ npm cache across jobs
- ✅ Playwright browser cache
- ✅ Node.js module cache
- ✅ TypeScript compilation cache

### **Parallel Execution**

- ✅ Unit and browser tests run in parallel
- ✅ Matrix testing across Node.js versions
- ✅ Concurrent PR validation jobs

### **Smart Triggering**

- ✅ Concurrency cancellation for outdated runs
- ✅ Draft PR detection and skipping
- ✅ Path-based triggering for specific changes

## Security Integration

### **CodeQL Analysis**

- 🔍 Static code analysis
- 🛡️ Security vulnerability detection
- 📊 Security baseline tracking

### **Dependency Scanning**

- 🔍 npm audit integration
- ⚠️ Moderate-level vulnerability alerts
- 🤖 Automated dependency updates

## Monitoring and Alerts

### **Test Result Reporting**

- ✅ PR status checks
- 💬 Automated PR comments with results
- 📊 Coverage trend reporting
- 🔔 Failure notifications

### **Build Artifacts**

- 📦 Build artifact preservation
- 🔍 Bundle size tracking
- 📈 Performance regression detection

## Local Development Integration

### **Pre-commit Validation**

```bash
# Matches CI validation locally
npm run test:all      # Full test suite
npm run lint          # Code quality
npm run build         # Build verification
```

### **Coverage Debugging**

```bash
npm run test:coverage # Local coverage report
open coverage/index.html # Coverage visualization
```

## Troubleshooting

### **Common CI Failures**

1. **Browser Tests Timeout**
   - Check Playwright installation
   - Verify browser dependencies
   - Review test isolation

2. **Coverage Threshold**
   - Add tests for uncovered code
   - Review coverage exclusions
   - Check test environment setup

3. **Build Failures**
   - Verify TypeScript compilation
   - Check dependency conflicts
   - Review rollup configuration

### **Debug Commands**

```bash
# Local CI simulation
npm run test:all && npm run build

# Browser test debugging
npm run test:browser -- --headed

# Coverage analysis
npm run test:coverage -- --reporter=verbose
```

## Future Enhancements

### **Planned Improvements**

- 🌐 Multi-browser testing (Firefox, Safari)
- 📱 Mobile browser testing
- ⚡ Test result caching
- 📊 Performance benchmarking
- 🔄 Automated changelog generation

### **Metrics and Monitoring**

- 📈 Test execution time tracking
- 📊 Flaky test detection
- 🎯 Coverage trend analysis
- ⚡ CI performance optimization

---

This CI/CD pipeline ensures that Poly State maintains high quality standards while providing fast
feedback for developers and comprehensive validation for releases.
