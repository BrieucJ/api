# Contributing

## Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for React and TypeScript
- **Formatting**: Prettier (if configured)
- **Imports**: Use `@/` alias for `src/`

## Development Workflow

1. **Create a branch**

   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes**

   - Follow existing code patterns
   - Use QueryBuilder for database operations
   - Add tests for new features

3. **Test locally**

   ```bash
   bun run test
   bun run dev
   ```

4. **Commit**

   ```bash
   git commit -m "feat: add new feature"
   ```

5. **Push and create PR**

## Testing Guidelines

- Write tests for:

  - QueryBuilder operations
  - Job handlers
  - API route handlers
  - Utility functions

- Test files should be in `tests/` directories
- Use Bun's built-in test runner

## Database Changes

1. **Update schema** in `apps/backend/src/db/models/`
2. **Generate migration**:
   ```bash
   bun run db:generate
   ```
3. **Review migration** in `apps/backend/src/migrations/`
4. **Apply migration**:
   ```bash
   bun run db:migrate
   ```

