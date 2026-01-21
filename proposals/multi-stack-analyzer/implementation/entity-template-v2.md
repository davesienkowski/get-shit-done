# Entity Template v2 - Stack-Aware Semantic Documentation

## Overview

Enhanced entity template providing stack-specific structure for semantic codebase documentation. Supports cross-language references, framework-specific patterns, and intelligent tooling integration.

## Template Specification

### Universal Frontmatter

```markdown
---
path: {absolute_path}
stack: javascript|typescript|python|go|rust|java|csharp|powershell|ruby|php|swift|kotlin|sql|shell
framework: react|vue|angular|django|flask|fastapi|spring|dotnet|blazor|rails|laravel|flutter|express|nextjs|...
type: module|component|util|config|api|service|model|test|hook|controller|query|migration|middleware|repository|entity
layer: presentation|business|data|infrastructure|cross-cutting
updated: YYYY-MM-DD
status: active|deprecated|experimental|legacy
complexity: low|medium|high|critical
---
```

### Standard Sections (All Stacks)

```markdown
## Purpose
[1-3 sentences: WHAT this entity does and WHY it exists]

## Core Responsibilities
- Primary responsibility
- Secondary responsibility
- Edge cases handled

## Exports
[Stack-specific format - see examples below]

## Dependencies

### Internal
- [[entity-slug]] - why needed
- [[other-entity]] - relationship

### Cross-Stack
- [stack:entity-slug] - integration point

### External
- package-name@version - what it provides

## Used By
[Auto-populated by tooling]
- [[consumer-entity]] - how used

## Configuration
[If applicable]
- Environment variables
- Config files
- Feature flags

## Key Algorithms
[If complex logic present]

## Performance Considerations
[If performance-critical]

## Security Notes
[If handles sensitive data/auth]

## Testing Strategy
[Test coverage approach]

## Known Issues
[Current limitations/technical debt]
```

---

## Complete Examples

### Example 1: React Component (TypeScript)

```markdown
---
path: /src/components/UserProfile/UserProfile.tsx
stack: typescript
framework: react
type: component
layer: presentation
updated: 2026-01-20
status: active
complexity: medium
---

## Purpose
Displays user profile information with real-time updates via SignalR. Handles avatar upload, field validation, and role-based editing permissions. Central component for user management workflows.

## Core Responsibilities
- Render user demographic data (name, email, role, avatar)
- Enable inline editing for authorized users (Admin, Manager roles)
- Stream profile changes via SignalR hub to keep multi-tab sessions synchronized
- Validate email format and username uniqueness before save
- Handle avatar upload with size/format constraints (max 2MB, JPG/PNG only)

## Exports

### Component
```typescript
export const UserProfile: FC<UserProfileProps>
```

### Props Interface
```typescript
interface UserProfileProps {
  userId: string;
  editable?: boolean;
  onSave?: (user: UserData) => Promise<void>;
  onCancel?: () => void;
}
```

### Types
```typescript
export type UserData = {
  id: string;
  username: string;
  email: string;
  role: 'Admin' | 'Manager' | 'User';
  avatarUrl?: string;
  lastLogin: Date;
}
```

## Dependencies

### Internal
- [[use-signalr-connection]] - Real-time profile updates across sessions
- [[use-auth-context]] - Current user role for edit permission checks
- [[api-client]] - REST calls for save/upload operations
- [[avatar-upload]] - Image cropping and compression before upload

### External
- react@18.2.0 - Core framework
- @microsoft/signalr@7.0.0 - WebSocket connection to UserHub
- react-hook-form@7.43.0 - Form state and validation
- zod@3.22.0 - Email/username schema validation

## Used By
- [[user-list-page]] - Profile modal from user table
- [[dashboard-widget]] - Quick profile view in header
- [[admin-user-management]] - Full edit mode for admins

## State Management

### Local State
- `isEditing: boolean` - Toggle between view/edit modes
- `uploadProgress: number` - Avatar upload progress (0-100)
- `validationErrors: Record<string, string>` - Field-level errors

### SignalR Subscriptions
- `UserHub.ProfileUpdated` - Receives external profile changes
- `UserHub.AvatarChanged` - Real-time avatar URL updates

## Key Algorithms

### Email Validation
Uses Zod schema with RFC 5322 compliant regex + DNS validation option:
```typescript
const emailSchema = z.string()
  .email()
  .refine(async (email) => {
    const exists = await checkEmailExists(email, userId);
    return !exists;
  }, 'Email already in use');
```

### Avatar Upload Flow
1. Client-side compression (max 800x800px, 85% JPEG quality)
2. Chunked upload for files >500KB
3. Server generates 3 sizes (thumbnail/medium/full)
4. SignalR broadcast to invalidate cached avatars

## Performance Considerations
- Debounces email validation API calls (500ms)
- Lazy loads avatar editor modal (code-split bundle: ~45KB)
- Memoizes user role permissions check
- Optimistic UI updates with rollback on save failure

## Security Notes
- **Authorization**: Edit mode disabled unless current user is Admin or viewing own profile
- **Input Sanitization**: All text fields sanitized server-side (XSS prevention)
- **Avatar Upload**: Server validates MIME type + magic bytes (prevents malicious file upload)
- **Rate Limiting**: Max 5 save attempts per minute per user

## Testing Strategy
- **Unit Tests**: 23 tests covering validation, state transitions, permission logic
- **Integration Tests**: SignalR connection mocking with MSW
- **E2E Tests**: Cypress flows for edit/save/cancel workflows
- **Visual Regression**: Percy snapshots for view/edit modes

## Known Issues
- **PROFILE-142**: Avatar upload fails on Safari 15.x (FormData boundary issue) - workaround uses legacy XHR
- **PROFILE-089**: Race condition when saving during active SignalR update - needs optimistic concurrency token
```

---

### Example 2: Python FastAPI Endpoint

```markdown
---
path: /src/api/routes/users.py
stack: python
framework: fastapi
type: api
layer: presentation
updated: 2026-01-20
status: active
complexity: medium
---

## Purpose
RESTful API endpoints for user CRUD operations. Handles authentication, pagination, filtering, and role-based access control. Primary interface for user management in React frontend.

## Core Responsibilities
- Expose REST endpoints: GET /users, GET /users/{id}, POST /users, PATCH /users/{id}, DELETE /users/{id}
- Enforce JWT authentication and role-based permissions
- Validate request payloads against Pydantic schemas
- Delegate business logic to UserService layer
- Return standardized error responses (RFC 7807 Problem Details)

## Exports

### Routes
```python
@router.get("/users", response_model=PaginatedResponse[UserResponse])
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    role: Optional[UserRole] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user)
)

@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user)
)

@router.post("/users", status_code=201, response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(require_role(UserRole.ADMIN))
)

@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user)
)

@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID,
    current_user: User = Depends(require_role(UserRole.ADMIN))
)
```

### Schemas
```python
class UserResponse(BaseModel):
    id: UUID
    username: str
    email: EmailStr
    role: UserRole
    avatar_url: Optional[HttpUrl]
    last_login: datetime
    created_at: datetime

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8)
    role: UserRole = UserRole.USER

class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
```

## Dependencies

### Internal
- [[services.user_service]] - Business logic for user operations
- [[auth.dependencies]] - JWT validation, current user extraction
- [[db.session]] - SQLAlchemy async session management
- [[schemas.pagination]] - PaginatedResponse generic type

### Cross-Stack
- [typescript:user-profile-component] - Primary consumer of these endpoints
- [csharp:user-sync-job] - Reads user data for AD synchronization

### External
- fastapi@0.108.0 - Web framework and dependency injection
- pydantic@2.5.0 - Request/response validation
- sqlalchemy@2.0.23 - ORM for database queries
- python-jose@3.3.0 - JWT token verification

## Used By
- [[user-profile-component]] - GET /users/{id}, PATCH /users/{id}
- [[user-list-page]] - GET /users with pagination/filtering
- [[admin-panel]] - All endpoints for user management

## Authorization Matrix

| Endpoint | Anonymous | User | Manager | Admin |
|----------|-----------|------|---------|-------|
| GET /users | ✗ | Own only | All | All |
| GET /users/{id} | ✗ | Own only | All | All |
| POST /users | ✗ | ✗ | ✗ | ✓ |
| PATCH /users/{id} | ✗ | Own only | All | All |
| DELETE /users/{id} | ✗ | ✗ | ✗ | ✓ |

## Request/Response Examples

### GET /users?page=1&limit=20&role=Admin
**Response (200)**:
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "john.doe",
      "email": "john@example.com",
      "role": "Admin",
      "avatar_url": "https://cdn.example.com/avatars/john.jpg",
      "last_login": "2026-01-20T10:30:00Z",
      "created_at": "2025-06-15T08:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "pages": 1
}
```

### PATCH /users/{id}
**Request**:
```json
{
  "email": "newemail@example.com"
}
```
**Response (200)**: Updated UserResponse object

**Error (403)**:
```json
{
  "type": "https://api.example.com/errors/forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "Cannot modify other users unless Admin/Manager role"
}
```

## Performance Considerations
- **Pagination**: Default limit=20, max=100 to prevent large result sets
- **Database Queries**: Eager loads avatar relationship to avoid N+1
- **Caching**: Redis caches user lookups for 5 minutes (invalidated on update)
- **Search**: Full-text search on username/email uses PostgreSQL GIN index

## Security Notes
- **Authentication**: All endpoints require valid JWT token (except public health check)
- **Authorization**: Role-based checks enforced at route level via `require_role` dependency
- **Input Validation**: Pydantic validates all inputs, prevents SQL injection via parameterized queries
- **Rate Limiting**: 100 requests/minute per user via Redis-backed sliding window
- **Password Hashing**: Bcrypt with cost factor 12 (handled in UserService layer)
- **CORS**: Restricted to `https://app.example.com` origin only

## Testing Strategy
- **Unit Tests**: 18 route tests with mocked UserService
- **Integration Tests**: 12 tests with real database (pytest fixtures)
- **Contract Tests**: Pact consumer tests shared with frontend team
- **Load Tests**: Locust scenarios targeting 500 req/s on GET /users

## Known Issues
- **API-234**: PATCH endpoint doesn't support partial nested object updates (e.g., can't update just avatar_url subfield)
- **API-189**: Search query with special regex chars causes 500 error - needs input sanitization
```

---

### Example 3: Go Service Layer

```markdown
---
path: /internal/users/service.go
stack: go
framework: none
type: service
layer: business
updated: 2026-01-20
status: active
complexity: high
---

## Purpose
Core business logic service for user domain operations. Orchestrates validation, persistence, caching, event publishing, and third-party integrations. Ensures consistent business rules across all user operations.

## Core Responsibilities
- Validate business rules (username uniqueness, email format, password strength)
- Coordinate user CRUD operations across repository, cache, and event bus
- Publish domain events (UserCreated, UserUpdated, UserDeleted) to message broker
- Integrate with external identity provider (Okta) for SSO synchronization
- Handle avatar storage via S3-compatible object store
- Enforce data consistency and transaction boundaries

## Exports

### Service Interface
```go
type UserService interface {
    // GetByID retrieves user by UUID with role-based filtering
    GetByID(ctx context.Context, userID uuid.UUID, requester *User) (*User, error)

    // List returns paginated users with optional filtering
    List(ctx context.Context, opts ListOptions, requester *User) (*PaginatedUsers, error)

    // Create validates and persists new user, publishes UserCreated event
    Create(ctx context.Context, input CreateUserInput, requester *User) (*User, error)

    // Update applies partial updates, handles optimistic locking
    Update(ctx context.Context, userID uuid.UUID, input UpdateUserInput, requester *User) (*User, error)

    // Delete soft-deletes user, invalidates sessions, publishes event
    Delete(ctx context.Context, userID uuid.UUID, requester *User) error

    // UploadAvatar stores image in S3, generates thumbnails
    UploadAvatar(ctx context.Context, userID uuid.UUID, image io.Reader, contentType string) (*Avatar, error)

    // SyncWithOkta pulls latest user data from Okta API
    SyncWithOkta(ctx context.Context, userID uuid.UUID) error
}
```

### Types
```go
type User struct {
    ID           uuid.UUID
    Username     string
    Email        string
    PasswordHash string
    Role         UserRole
    AvatarURL    *string
    LastLogin    time.Time
    CreatedAt    time.Time
    UpdatedAt    time.Time
    Version      int64 // Optimistic locking
}

type CreateUserInput struct {
    Username string
    Email    string
    Password string
    Role     UserRole
}

type UpdateUserInput struct {
    Username *string
    Email    *string
    Role     *UserRole
}

type ListOptions struct {
    Page   int
    Limit  int
    Role   *UserRole
    Search *string
}

type PaginatedUsers struct {
    Items []*User
    Total int64
    Page  int
    Limit int
}
```

## Dependencies

### Internal
- [[repository.user_repository]] - PostgreSQL persistence layer
- [[cache.redis_cache]] - User data caching (5min TTL)
- [[events.event_publisher]] - RabbitMQ event bus for domain events
- [[storage.s3_client]] - Avatar image storage (MinIO)
- [[auth.password_hasher]] - Bcrypt password hashing (cost 12)
- [[validators.user_validator]] - Business rule validation logic

### Cross-Stack
- [python:api.routes.users] - Primary consumer of service methods
- [csharp:background.user_sync_job] - Calls SyncWithOkta for scheduled sync

### External
- github.com/lib/pq@1.10.9 - PostgreSQL driver
- github.com/go-redis/redis/v8@8.11.5 - Redis client
- github.com/streadway/amqp@1.0.0 - RabbitMQ client
- github.com/minio/minio-go/v7@7.0.63 - S3 client
- github.com/okta/okta-sdk-golang/v2@2.20.0 - Okta API client
- golang.org/x/crypto/bcrypt - Password hashing

## Used By
- [[api.handlers.user_handler]] - HTTP handler layer delegates to service
- [[grpc.user_service_server]] - gRPC server exposes service via protobuf
- [[jobs.user_cleanup_job]] - Calls Delete for inactive user purge

## Business Rules

### Username Validation
- Length: 3-50 characters
- Allowed chars: alphanumeric, underscore, hyphen
- Must be unique (case-insensitive)
- Cannot start with underscore

### Email Validation
- RFC 5322 compliant format
- Must be unique (case-insensitive)
- Corporate domain whitelist: `@example.com`, `@partner.com`
- Disposable email providers blocked (via stopforumspam.com API)

### Password Requirements
- Minimum 8 characters
- Must contain: uppercase, lowercase, digit, special char
- Cannot contain username or email local part
- Checked against HaveIBeenPwned API (k-anonymity model)

### Role Assignment
- Default role: `User`
- Only `Admin` can assign `Admin` role
- `Manager` can assign `User` or `Manager` roles
- Role changes trigger session invalidation

## Key Algorithms

### Optimistic Locking
Uses version field to prevent lost updates:
```go
func (s *userService) Update(ctx context.Context, userID uuid.UUID, input UpdateUserInput, requester *User) (*User, error) {
    user, err := s.repo.GetByID(ctx, userID)
    if err != nil {
        return nil, err
    }

    // Apply updates
    applyUpdates(user, input)
    user.Version++

    // UPDATE users SET ... WHERE id = ? AND version = ?
    err = s.repo.Update(ctx, user)
    if errors.Is(err, ErrVersionMismatch) {
        return nil, ErrConcurrentModification
    }

    return user, nil
}
```

### Avatar Thumbnail Generation
Creates 3 sizes using imaging library:
- Thumbnail: 64x64px
- Medium: 256x256px
- Full: 800x800px (original aspect ratio preserved)

Uploads to S3 paths:
- `avatars/{userID}/thumbnail.jpg`
- `avatars/{userID}/medium.jpg`
- `avatars/{userID}/full.jpg`

## Event Publishing

### UserCreated Event
```json
{
  "event_type": "user.created",
  "event_id": "uuid",
  "timestamp": "2026-01-20T10:30:00Z",
  "payload": {
    "user_id": "uuid",
    "username": "john.doe",
    "email": "john@example.com",
    "role": "User"
  }
}
```

### UserUpdated Event
Includes `changed_fields` array to enable selective downstream processing.

### UserDeleted Event
Triggers cascading cleanup (sessions, tokens, cache invalidation).

## Performance Considerations
- **Caching**: Redis caches user lookups for 5 minutes, write-through on updates
- **Database Indexing**: Composite index on (email, deleted_at) for soft-delete queries
- **Connection Pooling**: PostgreSQL pool sized at 25 connections (max_idle=5)
- **Batch Operations**: List queries use cursor-based pagination to prevent deep offset penalty
- **Avatar Upload**: Thumbnail generation runs async in goroutine pool (max 10 workers)

## Security Notes
- **Password Storage**: Bcrypt with cost 12, salted automatically
- **Authorization**: All methods check requester permissions before operation
- **Audit Logging**: All mutations logged to `audit_log` table with requester_id
- **Data Sanitization**: HTML tags stripped from username/email fields
- **Rate Limiting**: Service layer enforces 100 ops/min per user (Redis counter)

## Error Handling Strategy
```go
// Domain errors
var (
    ErrUserNotFound           = errors.New("user not found")
    ErrUnauthorized           = errors.New("unauthorized operation")
    ErrUsernameExists         = errors.New("username already exists")
    ErrEmailExists            = errors.New("email already exists")
    ErrWeakPassword           = errors.New("password does not meet requirements")
    ErrConcurrentModification = errors.New("user modified by another process")
    ErrInvalidRole            = errors.New("invalid role assignment")
)

// Wrapped errors preserve context
return fmt.Errorf("failed to create user: %w", err)
```

## Testing Strategy
- **Unit Tests**: 47 tests with mocked repository/cache/event bus
- **Integration Tests**: 15 tests with real PostgreSQL/Redis (testcontainers)
- **Property Tests**: Rapid library for username/email validation edge cases
- **Benchmark Tests**: GetByID, List, Create operations (targets: <10ms, <50ms, <100ms)

## Known Issues
- **SRV-456**: SyncWithOkta fails for users with >10 group memberships (Okta API pagination bug) - workaround uses manual cursor
- **SRV-223**: Avatar upload for >5MB images causes timeout - needs streaming multipart upload
- **SRV-112**: Concurrent deletes can cause phantom cache entries - cache invalidation needs distributed lock
```

---

### Example 4: C# Blazor Server Page

```markdown
---
path: /Provider-Symplr-Dashboard/Pages/Dashboard/Dashboard.razor
stack: csharp
framework: blazor
type: component
layer: presentation
updated: 2026-01-20
status: active
complexity: high
---

## Purpose
Real-time monitoring dashboard for Symplr extract operations. Displays live extraction progress, facility status grid, recent alerts, and baseline comparison summaries. Primary landing page for healthcare data operations team.

## Core Responsibilities
- Render 4 dashboard widgets: Extract Monitor, Facility Status, Recent Alerts, Baseline Comparison Summary
- Establish SignalR connection to ExtractMonitoringHub for real-time progress updates
- Refresh data automatically on SignalR events (ExtractStarted, ProgressUpdated, ExtractCompleted)
- Handle manual refresh via button click (debounced to prevent spam)
- Display loading skeletons during initial data fetch
- Show error banners for SignalR disconnection or data load failures
- Navigate to detail pages (Extracts, Facilities, Alerts, Comparisons) on widget clicks

## Exports

### Component
```csharp
@page "/dashboard"
@using Provider_Symplr_Dashboard.Services
@using Provider_Symplr_Dashboard.Models
@using Microsoft.AspNetCore.SignalR.Client
@inject IExtractService ExtractService
@inject IFacilityService FacilityService
@inject IAlertService AlertService
@inject IBaselineComparisonService ComparisonService
@inject NavigationManager Navigation
@inject ILogger<Dashboard> Logger
```

### Code-Behind Class
```csharp
public partial class Dashboard : ComponentBase, IAsyncDisposable
{
    private HubConnection? _hubConnection;
    private ExtractStatus? _currentExtract;
    private List<FacilityStatus> _facilities = new();
    private List<Alert> _recentAlerts = new();
    private BaselineComparisonSummary? _comparisonSummary;
    private bool _isLoading = true;
    private string? _errorMessage;
    private DateTime _lastRefresh;

    protected override async Task OnInitializedAsync()
    protected override async Task OnAfterRenderAsync(bool firstRender)
    private async Task InitializeSignalRConnection()
    private async Task LoadDashboardData()
    private async Task HandleRefreshClick()
    private void NavigateToExtracts()
    private void NavigateToFacilities()
    private void NavigateToAlerts()
    private void NavigateToComparisons()
    public async ValueTask DisposeAsync()
}
```

## Dependencies

### Internal
- [[Services.IExtractService]] - Fetches current extract status and recent history
- [[Services.IFacilityService]] - Loads facility status grid (active/inactive/error counts)
- [[Services.IAlertService]] - Retrieves top 5 recent alerts ordered by severity
- [[Services.IBaselineComparisonService]] - Gets baseline comparison summary statistics
- [[Hubs.ExtractMonitoringHub]] - SignalR hub for real-time extract progress updates
- [[Components.ExtractMonitorWidget]] - Reusable widget showing live extraction progress
- [[Components.FacilityStatusGrid]] - Color-coded grid of facility statuses
- [[Components.AlertSummaryCard]] - Compact alert list with severity badges
- [[Components.ComparisonSummaryWidget]] - Baseline comparison delta visualization

### External
- Microsoft.AspNetCore.Components.Web@8.0 - Blazor Server framework
- Microsoft.AspNetCore.SignalR.Client@8.0 - SignalR hub connection
- Microsoft.Extensions.Logging@8.0 - Structured logging

## Used By
- [[Shared.NavMenu]] - Main navigation links to /dashboard
- [[Shared.MainLayout]] - Dashboard is default home page

## SignalR Integration

### Hub Connection Lifecycle
1. **OnAfterRenderAsync**: Establishes connection after first render
2. **Connection URL**: `/hubs/extract-monitoring`
3. **Reconnection**: Automatic with exponential backoff (5s, 10s, 30s intervals)
4. **Disposal**: Connection closed on component disposal

### Subscribed Events
```csharp
_hubConnection.On<ExtractStartedEvent>("ExtractStarted", async (evt) => {
    _currentExtract = new ExtractStatus {
        Id = evt.ExtractId,
        Status = "Running",
        StartTime = evt.StartTime
    };
    await InvokeAsync(StateHasChanged);
});

_hubConnection.On<ProgressUpdatedEvent>("ProgressUpdated", async (evt) => {
    if (_currentExtract?.Id == evt.ExtractId) {
        _currentExtract.Progress = evt.ProgressPercent;
        _currentExtract.CurrentDataset = evt.CurrentDataset;
        await InvokeAsync(StateHasChanged);
    }
});

_hubConnection.On<ExtractCompletedEvent>("ExtractCompleted", async (evt) => {
    if (_currentExtract?.Id == evt.ExtractId) {
        _currentExtract.Status = evt.Success ? "Completed" : "Failed";
        _currentExtract.EndTime = evt.EndTime;
        await LoadDashboardData(); // Refresh all widgets
    }
});

_hubConnection.On("FacilityStatusChanged", async () => {
    _facilities = await FacilityService.GetFacilityStatusesAsync();
    await InvokeAsync(StateHasChanged);
});

_hubConnection.On("AlertCreated", async () => {
    _recentAlerts = await AlertService.GetRecentAlertsAsync(5);
    await InvokeAsync(StateHasChanged);
});
```

## Component State

### Loading States
- `_isLoading = true`: Shows skeleton loaders for all widgets
- `_isLoading = false`: Renders actual data
- Loading triggered on: initial load, manual refresh, SignalR reconnection

### Error States
- `_errorMessage = null`: Normal operation
- `_errorMessage = "..."`: Displays error banner at top of page
- Errors cleared on successful data refresh

### Data Refresh Triggers
- Initial page load
- SignalR event received
- Manual refresh button click (debounced to max 1/second)
- SignalR reconnection after disconnect

## Markup Structure

```razor
@page "/dashboard"

<PageTitle>Dashboard - Provider Symplr</PageTitle>

<div class="dashboard-container">
    @if (!string.IsNullOrEmpty(_errorMessage))
    {
        <div class="alert alert-danger" role="alert">
            <i class="bi bi-exclamation-triangle"></i> @_errorMessage
        </div>
    }

    <div class="dashboard-header">
        <h1>Symplr Extract Dashboard</h1>
        <button class="btn btn-primary" @onclick="HandleRefreshClick" disabled="@_isLoading">
            <i class="bi bi-arrow-clockwise"></i> Refresh
        </button>
        <span class="last-refresh">Last updated: @_lastRefresh.ToString("HH:mm:ss")</span>
    </div>

    @if (_isLoading)
    {
        <LoadingSkeleton />
    }
    else
    {
        <div class="dashboard-grid">
            <ExtractMonitorWidget ExtractStatus="_currentExtract" OnClick="NavigateToExtracts" />
            <FacilityStatusGrid Facilities="_facilities" OnClick="NavigateToFacilities" />
            <AlertSummaryCard Alerts="_recentAlerts" OnClick="NavigateToAlerts" />
            <ComparisonSummaryWidget Summary="_comparisonSummary" OnClick="NavigateToComparisons" />
        </div>
    }

    <SignalRConnectionStatus Connection="_hubConnection" />
</div>
```

## Styling

### CSS Classes
- `.dashboard-container`: Main flex container with padding
- `.dashboard-header`: Flexbox row with title, refresh button, timestamp
- `.dashboard-grid`: CSS Grid layout (2x2 on desktop, 1 column on mobile)
- `.widget`: Base class for all dashboard widgets (shadow, border-radius, hover effects)

### Responsive Breakpoints
- Desktop (>992px): 2x2 grid
- Tablet (768-991px): 2x1 grid
- Mobile (<768px): 1 column stack

## Performance Considerations
- **Initial Load**: Parallel service calls using Task.WhenAll (reduces load time from 800ms to 300ms)
- **SignalR Batching**: Progress updates throttled to max 10/second to prevent UI flooding
- **Render Optimization**: Widget components use `ShouldRender()` to skip unnecessary re-renders
- **Data Caching**: Service layer caches facility/alert data for 30 seconds (reduces DB load)

## Security Notes
- **Authorization**: Page requires authenticated user (enforced via App.razor with AuthorizeRouteView)
- **SignalR Auth**: Hub connection includes JWT token in query string
- **CSRF**: Blazor Server includes automatic anti-forgery token validation
- **XSS**: All user-generated content sanitized via Blazor's automatic HTML encoding

## Accessibility
- **ARIA Labels**: All widgets have descriptive aria-label attributes
- **Keyboard Navigation**: Tab order follows logical widget sequence
- **Screen Reader**: SignalR updates announced via aria-live regions
- **Color Contrast**: WCAG AA compliant (4.5:1 minimum ratio)

## Testing Strategy
- **Unit Tests**: 12 bUnit tests for component rendering, event handling, navigation
- **Integration Tests**: 4 tests with mocked SignalR hub connection
- **E2E Tests**: Playwright scenarios for dashboard load, refresh, navigation flows
- **Visual Regression**: Percy snapshots for loading/loaded/error states

## Known Issues
- **DASH-234**: SignalR reconnection sometimes shows stale data for 2-3 seconds before refresh (race condition with StateHasChanged)
- **DASH-189**: Mobile layout breaks on landscape orientation for tablets 768-800px width (CSS media query gap)
- **DASH-156**: Memory leak when navigating away during active extraction (hub connection not disposed properly) - needs await DisposeAsync fix
```

---

### Example 5: PowerShell Function

```markdown
---
path: /projects/healthcare-integration/SymplrExtract/Public/Invoke-SymplrExtract.ps1
stack: powershell
framework: none
type: module
layer: business
updated: 2026-01-20
status: active
complexity: critical
---

## Purpose
Main orchestration function for Symplr healthcare provider data extraction. Coordinates execution of 4 Oracle SQL queries, CSV file generation, SFTP delivery, email notifications, and archival. Primary entry point for scheduled extractions via Windows Task Scheduler.

## Core Responsibilities
- Validate extraction environment (Oracle connectivity, credentials, file paths)
- Execute 4 dataset queries sequentially: Demographics, BoardCertifications, Education, Locations
- Generate pipe-delimited CSV files with timestamp naming convention
- Deliver files via SFTP to Symplr vendor and email to stakeholders
- Archive successful extracts to dated subdirectories
- Log all operations with structured JSON logging (Debug/Info/Warning/Error levels)
- Report progress to SignalR hub for real-time dashboard updates
- Handle errors with automatic retry logic (3 attempts with exponential backoff)

## Exports

### Function Signature
```powershell
function Invoke-SymplrExtract {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)]
        [ValidateSet('Development', 'Testing', 'Test', 'Production')]
        [string]$Environment,

        [Parameter()]
        [ValidateSet('All', 'Demographics', 'BoardCertifications', 'Education', 'Locations')]
        [string[]]$ExtractTypes = 'All',

        [Parameter()]
        [switch]$SkipDelivery,

        [Parameter()]
        [switch]$SkipArchive,

        [Parameter()]
        [switch]$ShowProgress,

        [Parameter()]
        [int]$MaxRetries = 3,

        [Parameter()]
        [ValidateRange(1, 300)]
        [int]$RetryDelaySeconds = 30
    )
}
```

### Output Object
```powershell
[PSCustomObject]@{
    Success = [bool]
    Environment = [string]
    StartTime = [datetime]
    EndTime = [datetime]
    Duration = [timespan]
    ExtractResults = @(
        @{
            Type = 'Demographics'
            RowCount = 12845
            FilePath = 'D:\Extracts\HealthcareCorp_Provider_Symplr_Demographics_20260120.txt'
            FileSize = 5242880 # bytes
            Success = $true
            Duration = [timespan]::FromSeconds(70)
        },
        # ... other datasets
    )
    DeliveryResults = @{
        SFTP = @{
            Success = $true
            Files = @('Demographics', 'BoardCertifications', 'Education', 'Locations')
            Duration = [timespan]::FromSeconds(15)
        }
        Email = @{
            Success = $true
            Recipients = @('stakeholder1@example.com', 'stakeholder2@example.com')
            Duration = [timespan]::FromSeconds(3)
        }
    }
    ArchivePath = 'D:\Archive\20260120_083045'
    Errors = @() # Array of error messages if any failures
}
```

## Dependencies

### Internal
- [[Private\DataAccess\Invoke-OracleQuery.ps1]] - Executes SQL queries via ODP.NET
- [[Private\DataAccess\Export-OracleDataToCsv.ps1]] - Converts DataTable to CSV with pipe delimiter
- [[Private\Delivery\Send-SymplrSftpDelivery.ps1]] - WinSCP SFTP upload with retry logic
- [[Private\Delivery\Send-SymplrEmailNotification.ps1]] - SMTP email with attachment support
- [[Private\Utility\Write-SymplrLog.ps1]] - Structured logging to JSON file + Event Log
- [[Private\Utility\Test-SymplrEnvironment.ps1]] - Pre-flight environment validation
- [[Private\Utility\New-SymplrArchive.ps1]] - Creates timestamped archive subdirectories
- [[Public\Get-SymplrConfiguration.ps1]] - Loads JSON configuration for environment

### Cross-Stack
- [csharp:Provider-Symplr-Dashboard] - ConfigurationSync.ps1 syncs config changes to JSON files
- [csharp:ExtractMonitoringHub] - Receives SignalR progress updates during extraction
- [sql:V_PROVIDER_QUALIFIED_PRACT] - Master Oracle view for all queries

### External
- Oracle.ManagedDataAccess.dll@23.26.0 - ODP.NET Managed Driver for Oracle connectivity
- WinSCP.exe@6.1.0 - SFTP client for vendor delivery
- CredentialManager PowerShell module@2.0 - Windows Credential Manager access

## Pipeline Support

### Input (Pipeline)
Accepts configuration objects from pipeline:
```powershell
Get-SymplrConfiguration -Environment Production | Invoke-SymplrExtract
```

### Output (Pipeline)
Returns execution result object for downstream processing:
```powershell
$result = Invoke-SymplrExtract -Environment Development
if ($result.Success) {
    $result | Send-CompletionEmail
}
```

## Business Rules

### Dataset Inclusion
- **All Mode** (default): Executes all 4 datasets sequentially
- **Selective Mode**: `-ExtractTypes Demographics,Locations` runs only specified datasets
- **Order**: Always executes in fixed order (Demographics → BoardCerts → Education → Locations)

### Board Certifications Filtering
**RITM09254122**: Only include certifications with `CERTIFIED=1` status
```sql
WHERE ABS(NVL(PS.CERTIFIED, 0)) = 1  -- Excludes lifetime/qualified certifications
```

### Language Filtering (Demographics)
Uses `Q:%` prefix filter for specific language subset:
```sql
WHERE PL.LANGUAGE_CODE LIKE 'Q:%'
```

### Facility Whitelisting
Reads facility codes from configuration:
```json
"FacilityFilter": {
  "WhitelistEnabled": true,
  "FacilityCodes": ["FAC001", "FAC002", "FAC003"]
}
```
Applied to all queries:
```sql
WHERE PF.FACCODE IN (:facilityList) AND PF.CURRENT_STATUS = 'ACTIVE'
```

## Execution Flow

### Phase 1: Validation (5-10 seconds)
```powershell
1. Load configuration from JSON
2. Validate Oracle connectivity (Test-OracleConnection)
3. Check Windows credentials exist (Test-SymplrCredentials)
4. Verify output directories writable
5. Validate SFTP host reachable (if not -SkipDelivery)
```

### Phase 2: Extraction (3-5 minutes total)
```powershell
foreach ($extractType in $ExtractTypes) {
    1. Load SQL template from Resources\SQL\$extractType.sql
    2. Bind facility whitelist parameters
    3. Execute query via Invoke-OracleQuery (returns DataTable)
    4. Convert to pipe-delimited CSV via Export-OracleDataToCsv
    5. Write to Extracts\HealthcareCorp_Provider_Symplr_$extractType_YYYYMMDD.txt
    6. Log row count, file size, duration
    7. Publish SignalR progress update (25%, 50%, 75%, 100%)
}
```

### Phase 3: Delivery (10-20 seconds)
```powershell
if (-not $SkipDelivery) {
    # SFTP Upload
    1. Establish WinSCP session to vendor SFTP host
    2. Upload all 4 files with retry logic (3 attempts)
    3. Verify remote file checksums match local
    4. Close SFTP session

    # Email Notification
    1. Load recipient list from configuration
    2. Generate HTML email body with extraction summary
    3. Attach CSV files (or skip if >10MB total)
    4. Send via SMTP with TLS encryption
}
```

### Phase 4: Archival (1-2 seconds)
```powershell
if (-not $SkipArchive) {
    1. Create Archive\YYYYMMDD_HHMMSS\ subdirectory
    2. Copy all 4 CSV files to archive directory
    3. Update archive index file (archive-index.json)
}
```

## Error Handling

### Retry Logic
Applies to Oracle queries and SFTP uploads:
```powershell
for ($attempt = 1; $attempt -le $MaxRetries; $attempt++) {
    try {
        # Execute operation
        break
    }
    catch {
        if ($attempt -eq $MaxRetries) { throw }
        Start-Sleep -Seconds ($RetryDelaySeconds * $attempt)  # Exponential backoff
    }
}
```

### Failure Modes
- **Oracle Connection Failed**: Logs error, sends failure email, exits with code 1
- **Partial Extraction**: Completes successful datasets, logs failures, sends warning email
- **Delivery Failed**: Logs warning, completes archival, returns Success=$false
- **Archive Failed**: Logs warning but returns Success=$true (non-critical)

### Logging Levels
- **Debug**: SQL query text, parameter values (only in Development environment)
- **Info**: Extraction start/end, row counts, file paths
- **Warning**: Retry attempts, non-critical failures (delivery, archive)
- **Error**: Critical failures (Oracle connection, query execution)

## Performance Benchmarks

### Target Performance (Production)
| Dataset | Target | Actual (v0.4.0) | Status |
|---------|--------|-----------------|--------|
| Demographics | <90s | 70s | ✓ |
| BoardCerts | <90s | 72s | ✓ |
| Education | <30s | 22s | ✓ |
| Locations | <30s | 19s | ✓ |
| **Total** | **<6m** | **3m 3s** | **✓** |

### Optimization Techniques
- **SQL CTEs**: Replaced subqueries with Common Table Expressions (40-84% improvement)
- **Oracle Bind Variables**: Prevents hard parsing for facility whitelist
- **Bulk Fetch**: OracleDataAdapter fetches 10,000 rows per batch
- **Parallel Delivery**: SFTP upload and email send run concurrently via Start-Job

## SignalR Integration

### Hub Connection
Established if `-ShowProgress` switch used or running under Hangfire scheduler:
```powershell
$hubConnection = Connect-SignalRHub -Url 'http://localhost:5119/hubs/extract-monitoring' -Token $jwtToken
```

### Progress Events
```powershell
Send-HubMessage -Connection $hubConnection -Method 'ExtractStarted' -Arguments @{
    ExtractId = $extractId
    Environment = $Environment
    StartTime = Get-Date
}

Send-HubMessage -Connection $hubConnection -Method 'ProgressUpdated' -Arguments @{
    ExtractId = $extractId
    ProgressPercent = 25
    CurrentDataset = 'Demographics'
}

Send-HubMessage -Connection $hubConnection -Method 'ExtractCompleted' -Arguments @{
    ExtractId = $extractId
    Success = $true
    EndTime = Get-Date
    RowCounts = @{ Demographics=12845; BoardCerts=8432; Education=3421; Locations=9876 }
}
```

## Security Notes
- **Credentials**: Never passed as parameters; retrieved from Windows Credential Manager
- **Connection Strings**: Stored in JSON config without passwords (uses Windows Auth or Credential Manager)
- **File Permissions**: Extracts/Archive directories restrict access to Administrators + Service Account
- **Audit Logging**: All executions logged to Windows Event Log (Application source: SymplrExtract)
- **SFTP Security**: Enforces SFTP with host key verification (no fallback to FTP)
- **Email Security**: SMTP requires TLS 1.2+, supports OAuth2 authentication

## Testing Strategy
- **Unit Tests (Pester)**: 47 tests covering parameter validation, error handling, output object structure
- **Integration Tests**: 8 tests with real Oracle connection (tagged `RequiresDatabase`)
- **Mock Data Tests**: 15 tests using SQLite in-memory database for SQL logic validation
- **Smoke Tests**: Daily automated run in Test environment via Hangfire
- **Performance Tests**: Monthly benchmark runs comparing to baseline metrics

## Known Issues
- **SE-234**: Extraction hangs if Oracle database in read-only mode during maintenance window (needs pre-flight check)
- **SE-189**: SFTP upload fails for files >100MB on slow network connections (WinSCP timeout) - needs chunked upload
- **SE-156**: SignalR connection fails silently if dashboard not running - needs connection validation
- **SE-112**: Concurrent executions from Hangfire + Task Scheduler cause file locking conflicts - needs distributed lock (Redis)
```

---

### Example 6: SQL Query

```markdown
---
path: /projects/healthcare-integration/SymplrExtract/Resources/SQL/Demographics.sql
stack: sql
framework: oracle
type: query
layer: data
updated: 2026-01-20
status: active
complexity: high
---

## Purpose
Extracts comprehensive healthcare provider demographic data from Oracle PPROV database for Symplr vendor integration. Joins 8 practitioner-related tables to produce flattened pipe-delimited output with NPI, names, credentials, languages, and facility assignments.

## Core Responsibilities
- Query master practitioner view V_PROVIDER_QUALIFIED_PRACT for baseline demographic data
- Join PRACTITIONER_LANGUAGES with `Q:%` prefix filter for specific language subset (per business requirements)
- Join PRACTITIONER_ID_NUMBERS to extract NPI (National Provider Identifier) as primary key
- Join PRACTITIONER_FACILITIES with configurable facility whitelist filter
- Aggregate multi-valued fields (languages, facilities) into comma-delimited strings
- Apply character sanitization (replace control characters with spaces for CSV compatibility)
- Return ~13,000 rows in 60-90 seconds (production performance benchmark)

## Output Schema

### Columns (22 fields)
```sql
NPI                  VARCHAR2(10)     -- National Provider Identifier (primary key)
PRACT_ID             VARCHAR2(20)     -- Internal practitioner ID
LAST_NAME            VARCHAR2(100)    -- Provider last name
FIRST_NAME           VARCHAR2(100)    -- Provider first name
MIDDLE_NAME          VARCHAR2(100)    -- Provider middle name/initial
SUFFIX               VARCHAR2(20)     -- Name suffix (MD, DO, PhD, etc.)
CREDENTIALS          VARCHAR2(500)    -- Professional credentials (comma-delimited if multiple)
GENDER               VARCHAR2(10)     -- M/F/Other
DATE_OF_BIRTH        DATE             -- Format: MM/DD/YYYY in output
LANGUAGES            VARCHAR2(4000)   -- Comma-delimited language codes (Q: prefixed only)
FACILITY_CODES       VARCHAR2(4000)   -- Comma-delimited facility assignments (active only)
SPECIALTY_PRIMARY    VARCHAR2(200)    -- Primary specialty description
SPECIALTY_SECONDARY  VARCHAR2(200)    -- Secondary specialty (if applicable)
DEGREE_TYPE          VARCHAR2(50)     -- Highest degree (MD, DO, MBBS, etc.)
MEDICAL_SCHOOL       VARCHAR2(500)    -- Medical school name
GRADUATION_YEAR      NUMBER(4)        -- Medical school graduation year
EMAIL                VARCHAR2(255)    -- Primary email address
PHONE                VARCHAR2(20)     -- Primary phone (format: (XXX) XXX-XXXX)
ADDRESS_LINE1        VARCHAR2(500)    -- Primary practice address line 1
CITY                 VARCHAR2(100)    -- City
STATE                VARCHAR2(2)      -- Two-letter state code
ZIP                  VARCHAR2(10)     -- ZIP code (XXXXX or XXXXX-XXXX format)
```

### Business Rules Applied
1. **Language Filtering**: Only includes languages with `LANGUAGE_CODE LIKE 'Q:%'` prefix
2. **Facility Whitelisting**: Filters to configurable facility codes (bind variable `:facilityList`)
3. **Active Status Only**: `CURRENT_STATUS = 'ACTIVE'` for both practitioners and facility assignments
4. **NPI Requirement**: Excludes practitioners without valid NPI (10-digit numeric)
5. **Character Sanitization**: Replaces ASCII control characters (0-31, 127) with spaces
6. **Multi-Value Aggregation**: Uses LISTAGG for languages/facilities (max 4000 chars, overflow truncates)

## Dependencies

### Internal
- [[V_PROVIDER_QUALIFIED_PRACT]] - Master materialized view (refreshed nightly at 2 AM)
- [[PRACTITIONER]] - Base practitioner demographic table
- [[PRACTITIONER_LANGUAGES]] - Many-to-many language proficiency
- [[PRACTITIONER_ID_NUMBERS]] - External identifiers (NPI, DEA, State License)
- [[PRACTITIONER_FACILITIES]] - Many-to-many facility assignments
- [[PRACTITIONER_SPECIALTIES]] - Primary/secondary specialty codes
- [[PRACTITIONER_EDUCATION]] - Medical school and degree information
- [[PRACTITIONER_CONTACT_INFO]] - Email, phone, address details

### Cross-Stack
- [powershell:Invoke-SymplrExtract] - Executes this query via Invoke-OracleQuery
- [csharp:ExtractService] - Dashboard preview queries use same base SQL

### External
None (pure Oracle SQL with no external dependencies)

## Used By
- [[Invoke-SymplrExtract.ps1]] - Main extraction orchestration
- [[Export-SymplrData.ps1]] - Single dataset extraction
- [[Dashboard.razor]] - Preview mode for data validation (LIMIT 100 rows)

## SQL Structure

### Query Pattern: CTE + Aggregation
```sql
WITH
-- CTE 1: Base practitioner demographics from master view
PractitionerBase AS (
    SELECT
        P.PRACT_ID,
        P.LAST_NAME,
        P.FIRST_NAME,
        P.MIDDLE_NAME,
        P.SUFFIX,
        P.CREDENTIALS,
        P.GENDER,
        P.DATE_OF_BIRTH,
        P.SPECIALTY_PRIMARY,
        P.SPECIALTY_SECONDARY,
        P.DEGREE_TYPE,
        P.MEDICAL_SCHOOL,
        P.GRADUATION_YEAR,
        P.EMAIL,
        P.PHONE,
        P.ADDRESS_LINE1,
        P.CITY,
        P.STATE,
        P.ZIP
    FROM V_PROVIDER_QUALIFIED_PRACT P
    WHERE P.CURRENT_STATUS = 'ACTIVE'
),

-- CTE 2: NPI lookup (filters to 10-digit numeric only)
NPILookup AS (
    SELECT
        PIN.PRACT_ID,
        PIN.ID_NUMBER AS NPI
    FROM PRACTITIONER_ID_NUMBERS PIN
    WHERE PIN.ID_TYPE = 'NPI'
      AND REGEXP_LIKE(PIN.ID_NUMBER, '^\d{10}$')  -- Exactly 10 digits
),

-- CTE 3: Language aggregation (Q: prefix filter)
LanguageAgg AS (
    SELECT
        PL.PRACT_ID,
        LISTAGG(PL.LANGUAGE_CODE, ',') WITHIN GROUP (ORDER BY PL.LANGUAGE_CODE) AS LANGUAGES
    FROM PRACTITIONER_LANGUAGES PL
    WHERE PL.LANGUAGE_CODE LIKE 'Q:%'
    GROUP BY PL.PRACT_ID
),

-- CTE 4: Facility aggregation (whitelist + active status filter)
FacilityAgg AS (
    SELECT
        PF.PRACT_ID,
        LISTAGG(PF.FACCODE, ',') WITHIN GROUP (ORDER BY PF.FACCODE) AS FACILITY_CODES
    FROM PRACTITIONER_FACILITIES PF
    WHERE PF.FACCODE IN (:facilityList)  -- Bind variable array
      AND PF.CURRENT_STATUS = 'ACTIVE'
    GROUP BY PF.PRACT_ID
)

-- Main SELECT: Join CTEs and apply character sanitization
SELECT
    N.NPI,
    PB.PRACT_ID,
    TRANSLATE(PB.LAST_NAME, CHR(0)||CHR(9)||CHR(10)||CHR(13), '    ') AS LAST_NAME,
    TRANSLATE(PB.FIRST_NAME, CHR(0)||CHR(9)||CHR(10)||CHR(13), '    ') AS FIRST_NAME,
    TRANSLATE(PB.MIDDLE_NAME, CHR(0)||CHR(9)||CHR(10)||CHR(13), '    ') AS MIDDLE_NAME,
    PB.SUFFIX,
    TRANSLATE(PB.CREDENTIALS, CHR(0)||CHR(9)||CHR(10)||CHR(13), '    ') AS CREDENTIALS,
    PB.GENDER,
    TO_CHAR(PB.DATE_OF_BIRTH, 'MM/DD/YYYY') AS DATE_OF_BIRTH,
    LA.LANGUAGES,
    FA.FACILITY_CODES,
    TRANSLATE(PB.SPECIALTY_PRIMARY, CHR(0)||CHR(9)||CHR(10)||CHR(13), '    ') AS SPECIALTY_PRIMARY,
    TRANSLATE(PB.SPECIALTY_SECONDARY, CHR(0)||CHR(9)||CHR(10)||CHR(13), '    ') AS SPECIALTY_SECONDARY,
    PB.DEGREE_TYPE,
    TRANSLATE(PB.MEDICAL_SCHOOL, CHR(0)||CHR(9)||CHR(10)||CHR(13), '    ') AS MEDICAL_SCHOOL,
    PB.GRADUATION_YEAR,
    PB.EMAIL,
    PB.PHONE,
    TRANSLATE(PB.ADDRESS_LINE1, CHR(0)||CHR(9)||CHR(10)||CHR(13), '    ') AS ADDRESS_LINE1,
    PB.CITY,
    PB.STATE,
    PB.ZIP
FROM PractitionerBase PB
INNER JOIN NPILookup N ON PB.PRACT_ID = N.PRACT_ID
LEFT JOIN LanguageAgg LA ON PB.PRACT_ID = LA.PRACT_ID
LEFT JOIN FacilityAgg FA ON PB.PRACT_ID = FA.PRACT_ID
ORDER BY N.NPI
```

## Performance Optimizations

### Indexing Strategy
```sql
-- Existing indexes leveraged by query
CREATE INDEX IDX_PRACT_STATUS ON PRACTITIONER(CURRENT_STATUS);
CREATE INDEX IDX_PIN_TYPE_NUMBER ON PRACTITIONER_ID_NUMBERS(ID_TYPE, ID_NUMBER);
CREATE INDEX IDX_PL_LANG_CODE ON PRACTITIONER_LANGUAGES(LANGUAGE_CODE);
CREATE INDEX IDX_PF_FAC_STATUS ON PRACTITIONER_FACILITIES(FACCODE, CURRENT_STATUS);
CREATE INDEX IDX_PF_PRACT_ID ON PRACTITIONER_FACILITIES(PRACT_ID);
```

### Execution Plan Highlights
- **CTE Materialization**: Oracle materializes CTEs once, prevents re-execution
- **Hash Joins**: Used for CTE joins (faster than nested loops for large datasets)
- **Parallel Execution**: Query hints enable DOP=4 (Degree of Parallelism)
- **Partition Pruning**: V_PROVIDER_QUALIFIED_PRACT partitioned by year (only current year scanned)

### Bind Variable Handling
```powershell
# PowerShell binding for facility whitelist
$facilityList = @('FAC001', 'FAC002', 'FAC003')
$parameters = @{
    facilityList = $facilityList
}
Invoke-OracleQuery -Sql $sql -Parameters $parameters
```

Oracle converts to:
```sql
WHERE PF.FACCODE IN ('FAC001', 'FAC002', 'FAC003')
```

### Performance Benchmarks

| Environment | Row Count | Execution Time | Throughput |
|-------------|-----------|----------------|------------|
| Development | 3,421 | 18s | 190 rows/sec |
| Test | 8,932 | 45s | 198 rows/sec |
| Production | 12,845 | 70s | 183 rows/sec |

**Legacy Comparison**: Original query (subquery-based) took 7m 34s for same data (84.6% improvement)

## Data Quality Validations

### Post-Query Checks (in PowerShell)
```powershell
# Validate NPI uniqueness
$duplicateNPIs = $results | Group-Object NPI | Where-Object Count -gt 1
if ($duplicateNPIs) {
    Write-SymplrLog -Level Warning -Message "Duplicate NPIs found: $($duplicateNPIs.Name -join ', ')"
}

# Validate required fields populated
$missingFields = $results | Where-Object { -not $_.LAST_NAME -or -not $_.FIRST_NAME }
if ($missingFields) {
    Write-SymplrLog -Level Warning -Message "$($missingFields.Count) rows missing required name fields"
}

# Validate facility assignments
$noFacilities = $results | Where-Object { -not $_.FACILITY_CODES }
if ($noFacilities) {
    Write-SymplrLog -Level Warning -Message "$($noFacilities.Count) practitioners with no active facility assignments"
}
```

### Known Data Quality Issues
- **DQ-123**: ~2% of practitioners missing primary specialty (SPECIALTY_PRIMARY is NULL)
- **DQ-089**: Language codes inconsistent format (some lack Q: prefix despite filter) - data entry issue
- **DQ-045**: Phone numbers stored in multiple formats (standardization needed in source system)

## Character Sanitization Rationale

### Problem
Oracle data contains control characters (tab, newline, carriage return) that break CSV parsing:
```
"Dr. John\nDoe"  -- Newline in name field breaks row alignment
```

### Solution
TRANSLATE function replaces control chars with spaces:
```sql
TRANSLATE(PB.LAST_NAME, CHR(0)||CHR(9)||CHR(10)||CHR(13), '    ')
--                       NULL   TAB    LF     CR         SPACES
```

### Fields Sanitized
- LAST_NAME, FIRST_NAME, MIDDLE_NAME
- CREDENTIALS, SPECIALTY_PRIMARY, SPECIALTY_SECONDARY
- MEDICAL_SCHOOL, ADDRESS_LINE1

Fields **NOT** sanitized (guaranteed clean by source system):
- NPI, PRACT_ID, EMAIL, PHONE, CITY, STATE, ZIP

## Security Notes
- **PHI Data**: Query returns Protected Health Information (HIPAA-covered)
  - NPI, NAME, DATE_OF_BIRTH, ADDRESS constitute identifiable patient data
  - Output files must be encrypted at rest and in transit
  - SFTP delivery enforces TLS 1.2+ encryption
- **Access Control**: Query execution requires PROVIDER_READ_ROLE Oracle role
- **Audit Logging**: All query executions logged to AUDIT_LOG table with user_id, timestamp, row_count
- **Data Masking**: Development/Test environments use Oracle Data Masking for DOB/ADDRESS fields

## Testing Strategy
- **Unit Tests (SQL Developer)**: 12 test cases for filter logic, aggregation, character sanitization
- **Integration Tests (PowerShell)**: 5 tests comparing output row counts against expected baselines
- **Regression Tests**: Monthly comparison of current output vs. prior month (validates schema stability)
- **Performance Tests**: Quarterly execution plan reviews with Oracle DBA team

## Known Issues
- **SQL-234**: LISTAGG overflow error when practitioner has >50 facility assignments (rare, affects 3 providers) - needs LISTAGG ON OVERFLOW TRUNCATE clause (Oracle 19c+)
- **SQL-189**: V_PROVIDER_QUALIFIED_PRACT materialized view refresh occasionally fails during weekend maintenance - needs automated retry logic
- **SQL-156**: Query performance degrades during month-end when PRACTITIONER table locked for batch updates - needs READ UNCOMMITTED hint or retry logic
```

---

## Stack-Specific Section Templates

### JavaScript/TypeScript React/Vue/Angular
```markdown
## Component API
- Props/Attributes
- Events Emitted
- Slots/Children
- Refs/Template Refs

## State Management
- Local State
- Global Store (Vuex/Redux/NgRx)
- Context Providers

## Lifecycle Hooks
- Mount/Created
- Update/Render
- Unmount/Destroy
```

### Python Django/Flask/FastAPI
```markdown
## Endpoints/Views
- URL patterns
- HTTP methods
- Request/Response schemas
- Query parameters

## Models/Schemas
- ORM models (Django/SQLAlchemy)
- Pydantic schemas (FastAPI)
- Serializers

## Middleware/Decorators
- Authentication
- Rate limiting
- CORS
```

### Go Services
```markdown
## Interface Definition
- Method signatures
- Return types
- Error handling

## Concurrency
- Goroutines
- Channels
- Mutexes/Sync primitives

## Context Handling
- Timeout propagation
- Cancellation
```

### C# .NET/Blazor
```markdown
## Class/Component Structure
- Public API
- Dependency Injection
- Lifecycle methods

## Razor Markup (Blazor)
- Parameters
- EventCallbacks
- RenderFragments

## Data Binding
- One-way/Two-way binding
- Cascading parameters
```

### PowerShell Modules
```markdown
## Function Signature
- Parameters (type, validation, pipeline support)
- Output type
- CmdletBinding attributes

## Pipeline Support
- ValueFromPipeline
- ValueFromPipelineByPropertyName

## Error Handling
- ErrorActionPreference
- Try/Catch patterns
```

### SQL Queries
```markdown
## Output Schema
- Column names and types
- Nullability
- Constraints

## Business Rules
- Filters applied
- Aggregations
- Join conditions

## Performance
- Indexes used
- Execution plan notes
- Row count estimates
```

---

## Migration Guide from v1

### Breaking Changes
1. **Frontmatter**: Add `stack`, `framework`, `layer` fields
2. **Exports Section**: Now stack-specific format (see examples)
3. **Dependencies**: Distinguish Internal/Cross-Stack/External

### Automated Conversion Script
```bash
# Convert all existing entity docs to v2 format
find .planning/intel -name "*.md" -exec sed -i \
  -e '/^type:/a stack: [DETECT_FROM_PATH]' \
  -e '/^type:/a framework: none' \
  -e '/^type:/a layer: [INFER_FROM_TYPE]' {} \;
```

### Tooling Integration
- **CLI**: `gsd:analyze-codebase` auto-detects stack from file extensions
- **Validation**: `entity-lint` enforces stack-specific section presence
- **Cross-References**: `[[slug]]` resolves within-stack, `[stack:slug]` resolves cross-stack

---

## Benefits of Stack-Aware Templates

1. **Precise Documentation**: Framework-specific sections capture relevant details (React hooks vs Go interfaces)
2. **Cross-Stack Navigation**: Explicit `[stack:entity]` references enable polyglot codebases
3. **Tooling Intelligence**: Static analysis can validate stack-appropriate patterns
4. **Onboarding Efficiency**: Developers immediately see stack context without inferring from code
5. **Search Optimization**: Filter entities by `stack:` or `framework:` frontmatter
6. **Migration Tracking**: `status: legacy` marks old stack components during rewrites

---

*Entity Template v2 | Stack-Aware Semantic Documentation | GSD Enhancement Proposal*
