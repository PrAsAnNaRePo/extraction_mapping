# Extraction Mapping Project Guidelines

## Commands
- **Frontend Build**: `npm run build` 
- **Frontend Dev**: `npm run dev` (with custom port: `npm run dev -- -p 55630`)
- **Frontend Start**: `npm run start`
- **Frontend Lint**: `npm run lint`
- **Backend Test**: `python test.py`

## Code Style Guidelines
- **Frontend**: TypeScript with React functional components + hooks
- **Backend**: Python

### TypeScript/React
- Use strict typing with proper interfaces/types
- Props interfaces: `ComponentNameProps` (e.g., `ImageAnnotatorProps`)
- Components: PascalCase (e.g., `ImageAnnotator`)
- Custom hooks: prefix with `use`
- State variables: camelCase

### Import Order
1. React imports
2. External libraries
3. Local imports using path aliases (@/...)

### Error Handling
- Use try/catch blocks for async operations
- Implement state-based error handling with conditional rendering

### CSS/Styling
- Use TailwindCSS with conditional class names (clsx + tailwind-merge)

### Component Structure
- Props interface at top
- Component logic in middle
- Event handlers before return statement
- Return/render JSX at bottom