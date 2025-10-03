# LaunchDarkly Flag Expiry Setter

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A  GitHub Action that  manages LaunchDarkly feature flag custom properties by setting an expiry date based on flag creation timestamps.

> **⚠️ Disclaimer**: This is not an officially supported LaunchDarkly solution. Use at your own discretion.

## Configuration

### Input Parameters

| Parameter | Description | Required | Default | Example |
|-----------|-------------|----------|---------|---------|
| `launchdarkly_api_key` | LaunchDarkly API access token (requires WRITE permission) | ✅ | - | `${{ secrets.LAUNCHDARKLY_API_KEY }}` |
| `project_key` | LaunchDarkly project key | ✅ | - | `my-project` |
| `days_from_creation` | Number of days from flag creation date to set expiry | ❌ | `30` | `90` |
| `custom_property_name` | Name of the custom property to set | ❌ | `flag.expiry.date` | `lifecycle.expiry.date` |
| `date_format` | Date format for the expiry date | ❌ | `MM/DD/YYYY` | `YYYY-MM-DD` |
| `skip_existing` | Skip flags that already have the expiry property set | ❌ | `true` | `false` |

### Supported Date Formats

| Format | Example | Description |
|--------|---------|-------------|
| `MM/DD/YYYY` | `03/15/2024` | US format (default) |
| `MM-DD-YYYY` | `03-15-2024` | US format with dashes |
| `YYYY-MM-DD` | `2024-03-15` | ISO 8601 format |
| `YYYY/MM/DD` | `2024/03/15` | International format |

### Output Parameters

| Output | Type | Description |
|--------|------|-------------|
| `updated_flags` | JSON Array | Flags that were successfully updated with expiry dates |
| `failed_flags` | JSON Array | Flags that failed to update with error details |
| `skipped_flags` | JSON Array | Flags that were skipped with reasons |
| `total_processed` | Number | Total number of flags that were processed |
| `total_found` | Number | Total number of flags found in the project |
| `total_skipped` | Number | Total number of flags that were skipped |

## Quick Start

### Basic Usage

```yaml
name: Set Flag Expiry Dates
on:
  schedule:
    - cron: '0 9 * * 1' # Every Monday at 9 AM
  workflow_dispatch: # Allow manual triggers

jobs:
  set-expiry-dates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set 30-day expiry on flags without expiry dates
        uses: your-org/launchdarkly-flag-expiry-setter@v1
        with:
          launchdarkly_api_key: ${{ secrets.LAUNCHDARKLY_API_KEY }}
          project_key: 'your-project-key'
          days_from_creation: '30'
```

### Advanced Configuration

```yaml
name: Flag Lifecycle Management
on:
  workflow_dispatch:
    inputs:
      project_key:
        description: 'LaunchDarkly project key'
        required: true
        default: 'my-project'
      days_from_creation:
        description: 'Days from creation to set expiry'
        required: false
        default: '90'

jobs:
  manage-flag-lifecycle:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set custom expiry dates
        uses: your-org/launchdarkly-flag-expiry-setter@v1
        with:
          launchdarkly_api_key: ${{ secrets.LAUNCHDARKLY_API_KEY }}
          project_key: ${{ github.event.inputs.project_key }}
          days_from_creation: ${{ github.event.inputs.days_from_creation }}
          date_format: 'YYYY-MM-DD'
          custom_property_name: 'lifecycle.expiry.date'
          skip_existing: 'false'
```

### Integration with Audit Action

```yaml
name: Complete Flag Lifecycle Management
on:
  schedule:
    - cron: '0 9 * * 1' # Monday at 9 AM

jobs:
  # First, set expiry dates on flags without them
  set-missing-expiry:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set 60-day expiry on flags without expiry dates
        uses: your-org/launchdarkly-flag-expiry-setter@v1
        with:
          launchdarkly_api_key: ${{ secrets.LAUNCHDARKLY_API_KEY }}
          project_key: 'your-project'
          days_from_creation: '60'
          skip_existing: 'true'

  # Then, audit for expiring flags
  audit-expiring:
    runs-on: ubuntu-latest
    needs: set-missing-expiry
    steps:
      - name: Audit expiring flags
        uses: devopsdina/ld-cp-exp-date-gh-actions-audit@v1
        with:
          launchdarkly_api_key: ${{ secrets.LAUNCHDARKLY_API_KEY }}
          project_key: 'your-project'
          days_ahead: '7'
          create_issues: 'true'

## Output Examples

<details>
<summary><strong>Successfully Updated Flags</strong></summary>

```json
[
  {
    "key": "my-feature-flag",
    "name": "My Feature Flag",
    "creationDate": "2025-07-18",
    "calculatedExpiryDate": "08/17/2025",
    "daysFromCreation": 30,
    "customPropertyName": "flag.expiry.date"
  }
]
```
</details>

<details>
<summary><strong>Skipped Flags</strong></summary>

```json
[
  {
    "key": "existing-flag",
    "name": "Existing Flag",
    "reason": "Already has flag.expiry.date",
    "existingValue": "09/15/2025"
  }
]
```
</details>

## Prerequisites

### LaunchDarkly API Token Setup

> **🔐 Security Note**: This action requires write access to your LaunchDarkly feature flags.

**Required Permissions:**
- ✅ Write access to feature flags in the target project
- ✅ Permission to modify custom properties

**Setup Instructions:**
1. Navigate to **Account Settings** → **Authorization** in LaunchDarkly
2. Click **Create Token**
3. Configure the token:
   - **Name**: `GitHub Actions Flag Expiry Setter`
   - **Role**: Writer or Admin
   - **Projects**: Select target projects
4. Copy the token and add it to GitHub Secrets as `LAUNCHDARKLY_API_KEY`

> **⚠️ Important**: Store the API token securely in GitHub Secrets. Never commit it to your repository.

## Common Use Cases

### 1. New Project Setup
Set expiry dates on all flags in a new project:
```yaml
- name: Initialize flag expiry dates
  uses: your-org/launchdarkly-flag-expiry-setter@v1
  with:
    launchdarkly_api_key: ${{ secrets.LAUNCHDARKLY_API_KEY }}
    project_key: 'new-project'
    days_from_creation: '90'
    skip_existing: 'false'
```

### 2. Cleanup Campaign
Add expiry dates to legacy flags without them:
```yaml
- name: Cleanup legacy flags
  uses: your-org/launchdarkly-flag-expiry-setter@v1
  with:
    launchdarkly_api_key: ${{ secrets.LAUNCHDARKLY_API_KEY }}
    project_key: 'legacy-project'
    days_from_creation: '30'
    skip_existing: 'true'
```

### 3. Compliance Requirements
Ensure all flags have expiry dates for audit purposes:
```yaml
- name: Compliance - Set expiry dates
  uses: your-org/launchdarkly-flag-expiry-setter@v1
  with:
    launchdarkly_api_key: ${{ secrets.LAUNCHDARKLY_API_KEY }}
    project_key: 'production'
    days_from_creation: '180'
    custom_property_name: 'compliance.expiry.date'
```

### 4. Different Expiry Policies by Flag Type
```yaml
# Short-lived experimental flags
- name: Set 30-day expiry on experimental flags
  uses: your-org/launchdarkly-flag-expiry-setter@v1
  with:
    launchdarkly_api_key: ${{ secrets.LAUNCHDARKLY_API_KEY }}
    project_key: 'experiments'
    days_from_creation: '30'

# Long-lived feature flags
- name: Set 180-day expiry on feature flags
  uses: your-org/launchdarkly-flag-expiry-setter@v1
  with:
    launchdarkly_api_key: ${{ secrets.LAUNCHDARKLY_API_KEY }}
    project_key: 'features'
    days_from_creation: '180'
```

## Troubleshooting

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| **"API key has no WRITE permissions"** | Insufficient token permissions | Ensure API 
| **Rate limiting errors** | Too many API requests | Built-in handling with exponential backoff |

## Contributing

We welcome contributions! Please see our [contribution guidelines](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## Related Projects

| Project | Description | Link |
|---------|-------------|------|
| **Flag Expiry Audit** | Audit flags for expiring dates | [GitHub](https://github.com/devopsdina/ld-cp-exp-date-gh-actions-audit) |

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.