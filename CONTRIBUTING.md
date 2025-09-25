# Contributing

## Setup

1. Fork this repository on GitHub
2. Clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/ExpoSnap.git
cd ExpoSnap
npm install
```

## Testing Your Changes

Use the test app to verify your changes work:

```bash
# Build and link your changes
npm run build
npm link

# Clone and setup test app
git clone https://github.com/edwarddjss/exposnap-test-app.git
cd exposnap-test-app
npm install
npm link exposnap

# Run test app
npm start
```

## Before Submitting

```bash
npm test
npm run typecheck  
npm run lint
npm run format
```

## Pull Request Checklist

- [ ] Tests pass
- [ ] Types check
- [ ] Lint passes
- [ ] Added tests for new features
- [ ] Tested with the test app
- [ ] Updated README if needed