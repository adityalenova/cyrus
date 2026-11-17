# Playwright E2E Testing Handbook

## Running Tests
```bash
npx playwright test
npx playwright test --ui
```

## Best Practices
- Favor semantic locators (`getByRole`, `getByText`, `getByLabel`).
- Test keyboard focus paths and dialog accessibility.
- Keep mocks predictable for network requests.
