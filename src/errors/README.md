# Error Handling for Data Loaders

This directory contains error classes for handling data loading failures in the Quran Search Engine library.

## Overview

The error handling system provides structured error types for data loading operations, allowing library consumers to catch and handle specific error scenarios programmatically.

## Architecture

### Base Error Class

**File**: `src/errors/base.error.ts`

The `BaseError` class extends the native JavaScript `Error` class and provides structured error codes and types:

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

- Extends native `Error` class for compatibility
- Implements `ErrorShape` interface from types
- Includes structured error codes and types
- Maintains proper prototype chain for `instanceof` checks
- Works across Node.js and browser environments

### Error Codes

**File**: `src/errors/error-codes.ts`

```typescript
export enum ErrorCode {
  DATA_FILE_NOT_FOUND = 'DATA_FILE_NOT_FOUND',
  DATA_PARSE_ERROR = 'DATA_PARSE_ERROR',
  DATA_SCHEMA_INVALID = 'DATA_SCHEMA_INVALID',
}

export enum ErrorType {
  DATA_ERROR = 'DataError',
}
```

## Data Loading Errors

**File**: `src/errors/data-load.error.ts`

### `DataFileNotFoundError`

Thrown when a required data file cannot be found.

```typescript
throw new DataFileNotFoundError('../data/morphology.json');
// Message: "Data file not found: ../data/morphology.json"
```

### `DataParseError`

Thrown when a data file cannot be parsed as JSON.

```typescript
throw new DataParseError('../data/morphology.json', cause);
// Message: "Failed to parse data file: ../data/morphology.json"
```

### `DataSchemaInvalidError`

Thrown when data has invalid schema or structure.

```typescript
throw new DataSchemaInvalidError('../data/morphology.json', 'Missing gid field');
// Message: "Invalid data schema in ../data/morphology.json: Missing gid field"
```

## Usage

### Basic Error Handling

```typescript
import { loadMorphology, DataFileNotFoundError, DataParseError } from 'quran-search-engine';

try {
  const morphology = await loadMorphology();
  // Use morphology data...
} catch (error) {
  if (error instanceof DataFileNotFoundError) {
    console.error('File not found:', error.message);
    // Handle missing file
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
import { loadQuranData, ErrorCode, BaseError } from 'quran-search-engine';

try {
  const data = await loadQuranData();
  return data;
} catch (error) {
  if (error instanceof BaseError) {
    switch (error.code) {
      case ErrorCode.DATA_FILE_NOT_FOUND:
        console.error('Data file missing');
        break;
      case ErrorCode.DATA_SCHEMA_INVALID:
        console.error('Data structure is invalid');
        break;
      default:
        console.error('Error:', error.message);
    }
  }
  throw error;
}
```

## Testing

All error classes are tested in:

- **`base.error.test.ts`** - Base error functionality
- **`data-load.error.test.ts`** - Data loading error scenarios
- **`loader.test.ts`** - Integration tests with loader functions

Run tests with:

```bash
pnpm test
```

## Integration

These error classes are integrated into:

- `loadMorphology()` - Validates morphology data structure
- `loadWordMap()` - Validates word map structure
- `loadQuranData()` - Validates Quran text data structure

All loader functions in `src/utils/loader.ts` throw appropriate error types based on the failure scenario.

## Files Structure

```
src/errors/
├── base.error.ts              # Base error class
├── base.error.test.ts         # Base error tests
├── error-codes.ts             # Error codes and types
├── data-load.error.ts         # Data loading errors
├── data-load.error.test.ts    # Data loading tests
├── index.ts                   # Exports
└── README.md                  # This file
```
