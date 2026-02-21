# Error Handling Architecture

This document describes the comprehensive error handling system implemented for the Quran Search Engine **library**.

## Overview

The error handling layer follows a **hierarchical, domain-layered architecture** with custom error classes extending a base `BaseError` class. All errors implement the `ErrorShape` interface and provide structured error codes, types, and actionable messages.

This system is designed for **library consumers** who can:

- Catch specific error types programmatically
- Get clear, actionable error messages with context
- Handle errors appropriately based on error type and code
- Use error codes for conditional logic

## Architecture

### Base Error Class

**File**: `src/errors/base.error.ts`

```typescript
export class BaseError extends Error implements ErrorShape {
  constructor(
    public code: string,
    public type: string,
    message: string,
  ) { ... }
}
```

**Features**:

- Extends native `Error` class
- Implements `ErrorShape` interface from types
- Includes structured error codes and types
- Maintains proper prototype chain for `instanceof` checks
- Works across Node.js and browser environments

### Error Codes and Types

**File**: `src/errors/error-codes.ts`

#### Error Codes (Enum)

- `DATA_FILE_NOT_FOUND` - Data file cannot be found
- `DATA_PARSE_ERROR` - Data file cannot be parsed
- `DATA_SCHEMA_INVALID` - Data structure is invalid
- `SEARCH_INVALID_QUERY` - Search query is invalid
- `SEARCH_MISSING_DEPENDENCIES` - Required dependencies missing
- `SEARCH_OPERATION_FAILED` - Search operation failed
- `VALIDATION_INVALID_PAGINATION` - Pagination parameters invalid
- `VALIDATION_INVALID_OPTIONS` - Options are invalid
- `VALIDATION_INVALID_VERSE_STRUCTURE` - Verse structure malformed
- `TOKENIZATION_MISSING_MORPHOLOGY` - Morphology data missing
- `TOKENIZATION_INVALID_MODE` - Tokenization mode invalid
- `TOKENIZATION_MISSING_WORD_MAP` - Word map required but missing

#### Error Types (Enum)

- `DataError` - Data loading and validation errors
- `SearchError` - Search operation errors
- `ValidationError` - Input validation errors
- `TokenizationError` - Tokenization errors

## Error Classes by Domain

### 1. Data Loading Errors

**File**: `src/errors/data-load.error.ts`

#### `DataFileNotFoundError`

Thrown when a required data file cannot be found.

```typescript
throw new DataFileNotFoundError('../data/morphology.json');
// Message: "Data file not found: ../data/morphology.json"
```

#### `DataParseError`

Thrown when a data file cannot be parsed as JSON.

```typescript
throw new DataParseError('../data/morphology.json', cause);
// Message: "Failed to parse data file: ../data/morphology.json"
```

#### `DataSchemaInvalidError`

Thrown when data has invalid schema or structure.

```typescript
throw new DataSchemaInvalidError('../data/morphology.json', 'Missing gid field');
// Message: "Invalid data schema in ../data/morphology.json: Missing gid field"
```

**Integration Points**:

- `loadMorphology()` - Validates morphology data structure
- `loadWordMap()` - Validates word map structure
- `loadQuranData()` - Validates Quran text data structure

### 2. Search Errors

**File**: `src/errors/search.error.ts`

#### `InvalidQueryError`

Thrown when search query is invalid or empty.

```typescript
throw new InvalidQueryError('', 'Query cannot be empty');
// Message: "Invalid search query "": Query cannot be empty"
```

#### `MissingDependenciesError`

Thrown when required search dependencies are missing.

```typescript
throw new MissingDependenciesError(['morphologyMap', 'wordMap']);
// Message: "Missing required dependencies for search: morphologyMap, wordMap"
```

#### `SearchOperationFailedError`

Thrown when a search operation fails.

```typescript
throw new SearchOperationFailedError('advancedSearch', cause);
// Message: "Search operation "advancedSearch" failed: {cause message}"
```

**Integration Points**:

- `search()` - Main search function validation
- `advancedSearch()` - Advanced search validation

### 3. Validation Errors

**File**: `src/errors/validation.error.ts`


#### `InvalidPaginationError`

Thrown when pagination parameters are invalid.

```typescript
throw new InvalidPaginationError(-1, 10);
// Message: "Invalid pagination parameters: page=-1, limit=10. Both must be positive numbers."
```

#### `InvalidOptionsError`

Thrown when search options are invalid.

```typescript
throw new InvalidOptionsError('lemma and root cannot both be false');
// Message: "Invalid options: lemma and root cannot both be false"
```

#### `InvalidVerseStructureError`

Thrown when verse structure is malformed.

```typescript
throw new InvalidVerseStructureError('Missing gid field');
// Message: "Invalid verse structure: Missing gid field"
```

**Integration Points**:

- Input validation in search functions
- Pagination validation
- Options validation

### 4. Tokenization Errors

**File**: `src/errors/tokenization.error.ts`

#### `MissingMorphologyError`

Thrown when morphology data is missing for a verse.

```typescript
throw new MissingMorphologyError(1234);
// Message: "Morphology data not found for verse GID: 1234"
```

#### `InvalidModeError`

Thrown when an invalid tokenization mode is provided.

```typescript
throw new InvalidModeError('invalid');
// Message: "Invalid tokenization mode: "invalid". Expected one of: text, lemma, root"
```

#### `MissingWordMapError`

Thrown when word map is required but missing.

```typescript
throw new MissingWordMapError('lemma');
// Message: "Word map is required for lemma mode tokenization"
```

**Integration Points**:

- `getPositiveTokens()` - Token extraction validation

## Usage Examples

### Basic Error Handling (Library Usage)

```typescript
import { loadMorphology, DataFileNotFoundError, DataParseError } from 'quran-search-engine';

try {
  const morphology = await loadMorphology();
  // Use morphology data...
} catch (error) {
  if (error instanceof DataFileNotFoundError) {
    console.error('File not found:', error.filePath);
    // Handle missing file (e.g., show user message, use fallback data)
  } else if (error instanceof DataParseError) {
    console.error('Parse error:', error.message);
    // Handle corrupted data
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Error Code Checking

```typescript
import { search, ErrorCode } from 'quran-search-engine';

try {
  const results = await search(query, data, morphology, wordMap, options);
  return results;
} catch (error) {
  if (error instanceof BaseError) {
    // Use error codes for conditional logic
    switch (error.code) {
      case ErrorCode.DATA_FILE_NOT_FOUND:
        console.error('Data file missing');
        break;
      case ErrorCode.SEARCH_INVALID_QUERY:
        console.error('Invalid query provided');
        break;
      default:
        console.error('Error:', error.message);
    }
  }
  throw error;
}
```

### Type Guards

```typescript
import { SearchError, ValidationError, DataLoadError } from 'quran-search-engine';

function handleError(error: unknown) {
  if (error instanceof SearchError) {
    // Handle search errors
  } else if (error instanceof ValidationError) {
    // Handle validation errors
  } else if (error instanceof DataLoadError) {
    // Handle data loading errors
  }
}
```

## Testing

All error classes are comprehensively tested:

- **`base.error.test.ts`** - Base error functionality, instanceof checks
- **`data-load.error.test.ts`** - Data loading error scenarios
- **`search.error.test.ts`** - Search error scenarios
- **`validation.error.test.ts`** - Validation error scenarios
- **`tokenization.error.test.ts`** - Tokenization error scenarios

Run tests with:

```bash
pnpm test
```

## Error Handling Best Practices

### For Library Consumers

1. **Catch specific error types** - Use `instanceof` checks to handle different error scenarios appropriately
2. **Check error codes programmatically** - Use `error.code` for conditional logic rather than parsing error messages
3. **Access error properties** - Use `error.filePath`, `error.gid`, etc. to get context about the error
4. **Provide user-friendly messages** - Don't expose technical error details directly to end users
5. **Handle all error types** - Always have a fallback for unexpected errors

### For Library Maintainers

1. **Throw specific error types** - Use the most specific error class available
2. **Include helpful context** - Add file paths, IDs, and relevant data to error messages
3. **Test error scenarios** - Write tests for all error conditions
4. **Document when errors are thrown** - Use JSDoc `@throws` tags in function documentation
5. **Don't catch errors unnecessarily** - Let errors bubble up unless you can handle them meaningfully

## Files Structure

```
src/errors/
├── base.error.ts              # Base error class
├── base.error.test.ts         # Base error tests
├── error-codes.ts             # Error codes and types enums
├── data-load.error.ts         # Data loading errors
├── data-load.error.test.ts    # Data loading tests
├── search.error.ts            # Search operation errors
├── search.error.test.ts       # Search error tests
├── validation.error.ts        # Validation errors
├── validation.error.test.ts   # Validation tests
├── tokenization.error.ts      # Tokenization errors
├── tokenization.error.test.ts # Tokenization tests
├── index.ts                   # Unified exports
└── README.md                  # This file
```

## Integration Status

- ✅ `BaseError` class with proper error structure
- ✅ Error codes and types enums
- ✅ Data loading errors **fully integrated** into `loader.ts`
- ✅ Error exports in main `index.ts`
- ✅ Comprehensive test coverage (20 tests, all passing)
- 🚧 Search errors (infrastructure-only, integration planned for separate PR)
- 🚧 Validation errors (infrastructure-only, integration planned for separate PR)
- 🚧 Tokenization errors (infrastructure-only, integration planned for separate PR)

**Note**: This PR provides the error handling infrastructure with immediate integration for data loading only. Search, validation, and tokenization errors are included as classes for future use but are not yet thrown in the codebase. Integration of these error types will be handled in follow-up PRs.

## Future Enhancements

1. **Error recovery strategies** - Retry logic for transient failures
2. **Localized error messages** - Support for multiple languages
3. **Error codes documentation** - Auto-generated error code reference
