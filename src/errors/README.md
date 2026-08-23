# Error Handling System

This directory contains error classes for handling failures across the Quran Search Engine library.

## Overview

The error handling system provides structured error types for data loading, search operations, validation, and
tokenization, allowing library consumers to catch and handle specific error scenarios programmatically.

## Architecture

### Base Error Class

**File**: `src/errors/base.error.ts`

The `BaseError` class extends the native JavaScript `Error` class and provides structured error codes and types.

**Features**:

- Extends native `Error` class for compatibility
- Implements `ErrorShape` interface from types
- Includes structured error codes and types
- Maintains proper prototype chain for `instanceof` checks
- Works across Node.js and browser environments

### Error Codes

**File**: `src/errors/error-codes.ts`

- **12 total error codes** across 4 categories
- **4 error types**: DataError, SearchError, ValidationError, TokenizationError

## Error Classes (10 Total)

### 1. Data Loading Errors (3)

- `DataFileNotFoundError` - Missing data files
- `DataParseError` - JSON parsing failures
- `DataSchemaInvalidError` - Invalid data structure

### 2. Search Errors (3)

- `InvalidQueryError` - Invalid search queries
- `MissingDependenciesError` - Missing required dependencies
- `SearchOperationFailedError` - Search operation failures

### 3. Validation Errors (2)

- `InvalidPaginationError` - Invalid pagination parameters
- `InvalidOptionsError` - Invalid search options

### 4. Tokenization Errors (2)

- `MissingMorphologyError` - Missing morphology data
- `InvalidModeError` - Invalid tokenization mode

## Integration Status

### ✅ Fully Integrated

- **Data Loading**: All loader functions throw appropriate errors
- **Search Validation**: `search()` validates pagination and dependencies
- **Tokenization Validation**: `getPositiveTokens()` validates mode parameter

## Testing

**Total**: 123 tests passing

- 18 error-specific unit tests
- 13 integration tests
- 92 existing tests

Run tests: `pnpm test`

## Files Structure
