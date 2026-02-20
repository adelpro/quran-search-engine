# feat: Comprehensive Error Handling System

## 📋 Summary

This PR implements a **hierarchical error handling architecture** for the Quran Search Engine library with:
- **16 domain-specific error classes** with structured error codes
- **Comprehensive test coverage** for loader functions and error scenarios
- **Schema validation** for all data loading operations
- **Type-safe error handling** with TypeScript enums

## 🎯 Motivation

The library currently throws generic `Error` objects with limited context, making it difficult for consumers to:
- Distinguish between different error types programmatically
- Understand what went wrong (missing file paths, IDs, etc.)
- Handle errors gracefully in their applications
- Test error scenarios comprehensively

## 🔄 Changes

### 1. Loader Test Improvements 

#### Added comprehensive error handling tests in `loader.test.ts`:
- ✅ Test for corrupted/invalid JSON files
- ✅ Test for malformed morphology entries
- ✅ Test for missing morphology.json file
- ✅ Test for missing word-map.json file
- ✅ Test for concurrent data loading

#### Updated loader implementation in `loader.ts`:
- ✅ Improved error messages with file path context
- ✅ Better error handling for module import failures
- ✅ Added JSDoc documentation

**Files Changed:**
- `src/utils/loader.test.ts` - Added 92 lines (5 new test cases)
- `src/utils/loader.ts` - Updated error handling logic

### 2. Error Handling System (This PR)

#### Core Infrastructure:
- **`base.error.ts`** - Base error class extending native `Error`
- **`error-codes.ts`** - 13 error codes and 4 error types (enums)
- **`errors/index.ts`** - Unified exports

#### Domain Error Classes (16 total):

**Data Loading Errors (4 classes):**
- `DataFileNotFoundError` - Missing data files
- `DataParseError` - JSON parsing failures
- `DataSchemaInvalidError` - Invalid data structure
- Base: `DataLoadError`

**Search Errors (4 classes):**
- `InvalidQueryError` - Invalid search queries
- `MissingDependenciesError` - Missing required dependencies
- `SearchOperationFailedError` - Search operation failures
- Base: `SearchError`

**Validation Errors (5 classes):**
- `NonArabicInputError` - Non-Arabic input text
- `InvalidPaginationError` - Invalid pagination parameters
- `InvalidOptionsError` - Invalid search options
- `InvalidVerseStructureError` - Malformed verse structure
- Base: `ValidationError`

**Tokenization Errors (4 classes):**
- `MissingMorphologyError` - Missing morphology data
- `InvalidModeError` - Invalid tokenization mode
- `MissingWordMapError` - Missing word map
- Base: `TokenizationError`

#### Integration:

**Updated `loader.ts` with error handling:**
- Replace generic errors with specific error classes
- Add schema validation for all data files
- Include file paths and context in error messages
- Proper error propagation

**Updated `loader.test.ts`:**
- Updated error message expectations
- Added type guards for error handling
- Better error type checking

**Updated `search.ts`:**
- Fixed `filterVerses` to return empty arrays when filter yields no results

**Updated `index.ts`:**
- Export all error classes
- Export `isArabic` utility

**Updated `types/index.ts`:**
- No changes needed (ErrorShape already exists)

#### Tests:
- **23 error-specific tests** (all passing)
- **66 total project tests** (all passing)
- 100% coverage of error classes

## 📊 File Changes Summary

### New Files (14):
```
src/errors/
├── base.error.ts              # Base error class
├── base.error.test.ts         # 3 tests
├── error-codes.ts             # Error enums
├── data-load.error.ts         # 4 error classes
├── data-load.error.test.ts    # 4 tests
├── search.error.ts            # 4 error classes
├── search.error.test.ts       # 6 tests
├── validation.error.ts        # 5 error classes
├── validation.error.test.ts   # 6 tests
├── tokenization.error.ts      # 4 error classes
├── tokenization.error.test.ts # 4 tests
├── index.ts                   # Exports
└── README.md                  # Documentation
```

### Modified Files (6):
```
src/utils/loader.ts            # Error integration + previous improvements
src/utils/loader.test.ts       # Updated tests + previous additions
src/core/search.ts             # Fixed filterVerses logic
src/index.ts                   # Export errors
src/data/morphology.json       # Formatted
```

## 🏗️ Architecture

### Error Hierarchy

```
BaseError extends Error
├── DataLoadError (file operations)
│   ├── DataFileNotFoundError
│   ├── DataParseError
│   └── DataSchemaInvalidError
├── SearchError (query operations)
│   ├── InvalidQueryError
│   ├── MissingDependenciesError
│   └── SearchOperationFailedError
├── ValidationError (input validation)
│   ├── NonArabicInputError
│   ├── InvalidPaginationError
│   ├── InvalidOptionsError
│   └── InvalidVerseStructureError
└── TokenizationError (text processing)
    ├── MissingMorphologyError
    ├── InvalidModeError
    └── MissingWordMapError
```

### Base Error Structure

```typescript
class BaseError extends Error {
  constructor(
    public code: ErrorCode,    // Enum-based error code
    public type: ErrorType,    // Category (DataError, SearchError, etc.)
    message: string            // Descriptive message with context
  )
}
```

### Error Codes

```typescript
enum ErrorCode {
  // Data (3)
  DATA_FILE_NOT_FOUND, DATA_PARSE_ERROR, DATA_SCHEMA_INVALID,
  
  // Search (3)
  SEARCH_INVALID_QUERY, SEARCH_MISSING_DEPENDENCIES, SEARCH_OPERATION_FAILED,
  
  // Validation (4)
  VALIDATION_NON_ARABIC_INPUT, VALIDATION_INVALID_PAGINATION,
  VALIDATION_INVALID_OPTIONS, VALIDATION_INVALID_VERSE_STRUCTURE,
  
  // Tokenization (3)
  TOKENIZATION_MISSING_MORPHOLOGY, TOKENIZATION_INVALID_MODE, 
  TOKENIZATION_MISSING_WORD_MAP,
}
```

## ✨ Key Benefits

### 1. Clear, Actionable Error Messages

**Before:**
```typescript
Error: "File not found"
Error: "Invalid query"
Error: "Missing data"
```

**After:**
```typescript
DataFileNotFoundError: "Data file not found: ./data/morphology.json"
InvalidQueryError: "Invalid search query '': Query cannot be empty"
MissingMorphologyError: "Morphology data not found for verse GID: 1234"
```

### 2. Programmatic Error Handling

```typescript
try {
  const morphology = await loadMorphology();
} catch (error) {
  if (error instanceof DataFileNotFoundError) {
    console.error(`Missing: ${error.filePath}`);
    // Use fallback data
  } else if (error instanceof DataParseError) {
    console.error(`Corrupted: ${error.filePath}`);
    // Re-download data
  }
}
```

### 3. Type-Safe Error Codes

```typescript
if (error.code === ErrorCode.DATA_FILE_NOT_FOUND) {
  // TypeScript autocomplete + validation
}
```

## 💻 Usage Examples

### Basic Error Handling
```typescript
import {
  loadMorphology,
  DataFileNotFoundError,
  DataParseError,
} from 'quran-search-engine';

try {
  const morphology = await loadMorphology();
} catch (error) {
  if (error instanceof DataFileNotFoundError) {
    console.error('Missing:', error.filePath);
    // Use fallback
  } else if (error instanceof DataParseError) {
    console.error('Corrupted:', error.filePath);
    // Re-download
  }
}
```

### Error Code Checking
```typescript
import { search, ErrorCode } from 'quran-search-engine';

try {
  return await search(query, data, morphology, wordMap);
} catch (error) {
  if (error.code === ErrorCode.SEARCH_INVALID_QUERY) {
    console.error('Invalid query');
  } else if (error.code === ErrorCode.DATA_FILE_NOT_FOUND) {
    console.error('Data file missing');
  }
}
```

## 🔄 Backward Compatibility

**✅ No breaking changes!** Existing code continues to work:

```typescript
// Still works - no changes needed
try {
  const data = await loadMorphology();
} catch (error) {
  console.error(error.message);
}

// But now you CAN handle specific errors
try {
  const data = await loadMorphology();
} catch (error) {
  if (error instanceof DataFileNotFoundError) {
    // Handle specific case
  } else {
    console.error(error.message); // Fallback
  }
}
```

## 🧪 Testing

### Test Results
```bash
✓ src/errors/base.error.test.ts (3 tests)
✓ src/errors/data-load.error.test.ts (4 tests)
✓ src/errors/search.error.test.ts (6 tests)
✓ src/errors/validation.error.test.ts (6 tests)
✓ src/errors/tokenization.error.test.ts (4 tests)
✓ src/utils/loader.test.ts (8 tests - includes previous additions)
✓ src/core/search.test.ts (18 tests)
✓ src/core/tokenization.test.ts (6 tests)
✓ src/utils/normalization.test.ts (11 tests)

Test Files:  9 passed (9)
     Tests: 66 passed (66)
     Build: ✅ Successful
      Lint: ✅ Clean
```

### Test Coverage
- **23 error-specific tests** covering all error classes
- **8 loader tests** (5 added in previous commit, 3 updated)
- **35 core functionality tests**

## 📝 Integration Status

### ✅ Completed
- [x] Base error infrastructure
- [x] All 16 error classes with tests
- [x] Data loader error integration
- [x] Loader comprehensive tests
- [x] Schema validation for all data files
- [x] Main exports
- [x] Documentation

### ⏳ Future Work
- [ ] Integrate search errors into `search.ts`
- [ ] Integrate validation errors into search functions
- [ ] Integrate tokenization errors into `tokenization.ts`
- [ ] Add error recovery strategies
- [ ] Add localized error messages

## 🤔 Discussion Points

1. **Error Messages**: Are they clear and actionable enough?
2. **Error Granularity**: Should we add more specific error types?
3. **Error Codes**: Should codes be more specific (e.g., `DATA_FILE_NOT_FOUND_MORPHOLOGY`)?
4. **Integration Approach**: Should remaining integrations be in this PR or separate PRs?
5. **Error Properties**: Are current properties (filePath, gid, cause) sufficient?

## 📚 Documentation

- **Complete README** in `src/errors/README.md` with:
  - Architecture overview
  - All error classes documented
  - Usage examples
  - Best practices
  - Integration guide

## 🚀 Migration Guide

No migration needed! This is purely additive:

1. **Existing code works unchanged** - All errors still extend `Error`
2. **Opt-in to specific handling** - Use `instanceof` when you want it
3. **Progressive enhancement** - Add error handling incrementally

## ✅ Checklist

- [x] Code follows project style guide
- [x] All tests passing (66/66)
- [x] Build successful
- [x] Linter clean (0 errors, 0 warnings)
- [x] No breaking changes
- [x] Documentation complete
- [x] Error classes exported
- [x] Backward compatible
- [x] Previous commit changes included
- [ ] Reviewed by maintainers
- [ ] Ready to merge

---

## 🔗 Related

- Closes #[issue-number] (if applicable)
- Previous commit: `da880af` - test: add proper error handling tests for loader functions

## 📸 Screenshots/Examples

See `src/errors/README.md` for comprehensive examples and documentation.

---

**Feedback and suggestions are welcome!** 🙏










