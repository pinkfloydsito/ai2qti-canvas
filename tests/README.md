# QTI Generator Test Suite

This directory contains comprehensive tests for the QTI Generator Electron application.

## Test Structure

### Test Files

1. **qti-xml-generation.test.js**
   - Tests XML generation functions
   - Validates QTI XML structure
   - Tests XML escaping and sanitization
   - Validates different question types XML output

2. **assessment-data.test.js**
   - Tests assessment data structure validation
   - Tests question type mapping
   - Tests data serialization/deserialization
   - Tests form validation logic

3. **file-handling.test.js**
   - Tests file operation workflows
   - Tests JSON and XML file handling
   - Tests error handling scenarios
   - Tests file filter configurations

4. **integration.test.js**
   - End-to-end workflow testing
   - Multi-question type assessments
   - Data integrity through save/load cycles
   - Complete QTI generation workflow

## Test Coverage

The test suite covers:

### Core Functionality
- ✅ QTI XML generation for all question types
- ✅ Assessment data management
- ✅ File save/load operations
- ✅ Form validation and sanitization
- ✅ Error handling scenarios

### Question Types Tested
- ✅ Multiple Choice questions
- ✅ True/False questions  
- ✅ Short Answer questions
- ✅ Essay questions
- ✅ Fill-in-the-blank questions

### Edge Cases
- ✅ Empty assessments
- ✅ Invalid data handling
- ✅ Special characters in content
- ✅ File operation errors
- ✅ User cancellation scenarios

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Framework

- **Jest**: Testing framework
- **JSDOM**: DOM environment for testing
- **@testing-library/jest-dom**: Additional matchers

## Test Configuration

Tests are configured via `jest.config.js` with:
- JSDOM test environment
- Setup file for test utilities
- Coverage reporting
- Test file patterns

## Mock Strategy

The tests use a mock-based approach to isolate units:
- Electron APIs are mocked
- File system operations are mocked
- DOM elements are mocked for UI testing
- IPC communication is mocked

## Test Data

Tests use realistic sample data including:
- Complete assessment structures
- Various question configurations
- Edge case scenarios
- Invalid input examples

## Validation Approach

Tests validate:
1. **Structure**: Correct object/XML structure
2. **Content**: Proper data preservation
3. **Behavior**: Expected function outcomes
4. **Edge Cases**: Error handling and edge scenarios
5. **Integration**: End-to-end workflows

## Coverage Goals

The test suite aims for comprehensive coverage of:
- All public methods and functions
- Error handling paths
- User interaction flows
- Data transformation logic
- File operation workflows

## Adding New Tests

When adding new features:
1. Add unit tests for new functions
2. Update integration tests for workflow changes
3. Add edge case testing
4. Update this documentation
5. Ensure tests pass before committing

## Test Utilities

Common test utilities and helpers are available in the setup file for:
- Mock data generation
- Common assertions
- Test environment setup
- Shared mock implementations