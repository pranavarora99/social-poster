# Social Poster - Architecture Documentation

## Overview
This Chrome extension has been completely refactored using Google's engineering best practices, featuring a modern TypeScript architecture with proper separation of concerns, comprehensive error handling, and performance optimization.

## Architecture Patterns

### 1. **Layered Architecture**
```
┌─────────────────────────┐
│      UI Layer           │ ← ui-controller.ts
├─────────────────────────┤
│   Application Layer     │ ← app-controller.ts
├─────────────────────────┤
│    Business Logic       │ ← services/, utils/
├─────────────────────────┤
│     Core Systems        │ ← core/
└─────────────────────────┘
```

### 2. **Core Systems (`/src/core/`)**

#### **Logger (`logger.ts`)**
- Structured logging with context and performance tracking
- Multiple log levels (DEBUG, INFO, WARN, ERROR)
- Automatic error reporting and storage
- Session tracking and performance metrics

#### **State Manager (`state-manager.ts`)**
- Centralized state management with reactive updates
- Immutable state with selective subscriptions
- Automatic persistence to Chrome storage
- Type-safe state mutations

#### **Error Boundary (`error-boundary.ts`)**
- Comprehensive error handling with recovery mechanisms
- Circuit breaker pattern for external services
- Retry logic with exponential backoff
- Global error catching and reporting

### 3. **Application Layer (`/src/controllers/`)**

#### **App Controller (`app-controller.ts`)**
- Main orchestrator for business logic
- Handles Chrome extension APIs
- Manages generation workflow
- Coordinates between services

### 4. **UI Layer (`/src/ui/`)**

#### **UI Controller (`ui-controller.ts`)**
- Pure UI management and event handling
- State binding and reactive updates
- DOM manipulation with error safety
- User interaction management

### 5. **Services (`/src/services/`)**

#### **API Service (`api-service.ts`)**
- HuggingFace API integration
- Token management and validation
- Retry logic and error handling

### 6. **Utilities (`/src/utils/`)**

#### **Memory Manager (`memory-manager.ts`)**
- Resource cleanup and memory optimization
- Object URL management
- Canvas pooling for image operations

#### **Performance Utils (`performance.ts`)**
- Debouncing and throttling
- Idle time processing
- Performance monitoring

#### **Sanitization (`sanitization.ts`)**
- XSS prevention and input validation
- Safe DOM manipulation
- Content filtering

#### **Telemetry (`telemetry.ts`)**
- Usage analytics and performance tracking
- Error reporting and monitoring
- Privacy-compliant data collection

## Key Improvements

### 1. **Loading States & UI Responsiveness**
- Progressive loading with visual feedback
- Non-blocking operations with proper async handling
- Graceful degradation on errors
- Real-time progress indicators

### 2. **Error Handling**
- Global error boundaries
- User-friendly error messages
- Automatic error recovery
- Comprehensive logging

### 3. **Performance Optimization**
- Memory management and cleanup
- Resource pooling
- Lazy loading and code splitting
- Efficient state updates

### 4. **Type Safety**
- Strict TypeScript configuration
- Comprehensive type definitions
- Runtime type checking
- Interface-based architecture

### 5. **Security**
- Input sanitization and validation
- XSS prevention
- Safe DOM manipulation
- Secure API token handling

## Data Flow

1. **User Interaction** → UI Controller
2. **State Change** → State Manager (reactive updates)
3. **Business Logic** → App Controller
4. **External APIs** → API Service (with error handling)
5. **UI Updates** → UI Controller (automatic binding)

## File Structure
```
src/
├── core/                    # Core systems
│   ├── logger.ts           # Logging system
│   ├── state-manager.ts    # State management
│   └── error-boundary.ts   # Error handling
├── controllers/             # Application logic
│   └── app-controller.ts   # Main controller
├── ui/                     # UI management
│   └── ui-controller.ts    # UI controller
├── services/               # External services
│   └── api-service.ts      # API integration
├── utils/                  # Utilities
│   ├── memory-manager.ts   # Memory management
│   ├── performance.ts      # Performance utils
│   ├── sanitization.ts     # Security utils
│   └── telemetry.ts        # Analytics
├── types/                  # Type definitions
│   └── index.ts           # Shared types
└── popup.ts               # Entry point
```

## Benefits

### **Reliability**
- Comprehensive error handling prevents crashes
- Circuit breakers protect against service failures
- Automatic retries for transient failures

### **Performance**
- Memory management prevents leaks
- Resource pooling optimizes operations
- Efficient state management reduces re-renders

### **Maintainability**
- Clear separation of concerns
- Type-safe interfaces
- Comprehensive logging for debugging

### **Scalability**
- Modular architecture allows easy feature addition
- Reactive state management scales with complexity
- Performance monitoring identifies bottlenecks

### **User Experience**
- Fast, responsive UI with proper loading states
- Graceful error handling with recovery options
- Progressive enhancement and offline capability

## Development Guidelines

1. **Always use the logger** for debugging and monitoring
2. **Update state through State Manager** for consistency
3. **Wrap operations in error boundaries** for reliability
4. **Use TypeScript strictly** for type safety
5. **Test error conditions** and edge cases
6. **Monitor performance** and memory usage
7. **Follow the layered architecture** for maintainability

This architecture provides a solid foundation for a reliable, performant, and maintainable Chrome extension that follows Google's engineering best practices.