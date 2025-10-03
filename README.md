# LaunchDarkly Flag Expiry Setter Action

A GitHub Action that automatically sets expiry date custom properties on LaunchDarkly feature flags based on their creation dates. This action helps teams proactively manage feature flag lifecycle at enterprise scale by automatically calculating and setting expiration dates.

## Features

- 🚀 **Fully Automated**: Processes all flags in a project automatically - no manual flag selection needed
- 📅 **Creation Date Based**: Calculates expiry dates from actual flag creation timestamps
- 🔄 **Enterprise Scale**: Handles thousands of flags with proper pagination and rate limiting
- 📊 **Smart Filtering**: Skips flags that already have expiry dates (configurable)
- 🎯 **Flexible Date Formats**: Supports MM/DD/YYYY, YYYY-MM-DD, MM-DD-YYYY, YYYY/MM/DD
- 🛡️ **Rate Limit Handling**: Built-in 429 retry logic with exponential backoff
- ⚡ **Batch Processing**: Processes flags in batches to avoid API overwhelm
- 📋 **Comprehensive Reporting**: Detailed summaries of processed, skipped, and failed flags
- 🔧 **Configurable**: Customizable expiry periods, property names, and date formats

## How It Works

1. **Fetches all flags** in the specified LaunchDarkly project (with pagination)
2. **Filters flags** that need expiry dates (skips existing if configured)
3. **Calculates expiry dates** by adding specified days to each flag's creation date
4. **Sets custom properties** in batches with rate limiting
5. **Reports results** with comprehensive success/failure breakdown

## Usage

This is not an officially supported solution. Use at your own risk.

### Basic Example - Set 30-day Expiry on All Flags

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

### Advanced Example - Custom Configuration

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
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `launchdarkly_api_key` | LaunchDarkly API access token (requires WRITE permission) | Yes | |
| `project_key` | LaunchDarkly project key | Yes | |
| `days_from_creation` | Number of days from flag creation date to set expiry | No | `30` |
| `custom_property_name` | Name of the custom property to set | No | `flag.expiry.date` |
| `date_format` | Date format for the expiry date | No | `MM/DD/YYYY` |
| `skip_existing` | Skip flags that already have the expiry property set | No | `true` |

### Date Format Options

- `MM/DD/YYYY` (e.g., `03/15/2024`) - **Default**
- `MM-DD-YYYY` (e.g., `03-15-2024`)
- `YYYY-MM-DD` (e.g., `2024-03-15`)
- `YYYY/MM/DD` (e.g., `2024/03/15`)

## Outputs

| Output | Description |
|--------|-------------|
| `updated_flags` | JSON array of flags that were successfully updated |
| `failed_flags` | JSON array of flags that failed to update |
| `skipped_flags` | JSON array of flags that were skipped |
| `total_processed` | Total number of flags processed |
| `total_found` | Total number of flags found in the project |
| `total_skipped` | Total number of flags skipped |

### Output Format Examples

#### Successfully Updated Flags
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

#### Skipped Flags
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

## API Requirements

### LaunchDarkly API Token

This action requires a LaunchDarkly API access token with **WRITE permissions** for feature flags.

To create an API token:

1. Go to **Account settings** > **Authorization** in LaunchDarkly
2. Click **Create token**
3. Provide a name for your token
4. Select a role with write permissions (Writer or Admin)
5. Choose the projects you want to modify
6. Save the token as a GitHub secret (e.g., `LAUNCHDARKLY_API_KEY`)

### Required Permissions

The API token needs:
- **Write access** to feature flags in the specified project
- Permission to modify custom properties

## Enterprise Features

### Automatic Pagination
- Handles projects with thousands of flags
- Processes all flags automatically with proper API pagination
- Progress tracking for large datasets

### Rate Limiting & Retry Logic
- Built-in 429 (rate limit) handling with exponential backoff
- Configurable delays between API requests
- Automatic retry on transient failures

### Batch Processing
- Processes flags in configurable batches (default: 10 flags per batch)
- Parallel processing within batches, sequential between batches
- Prevents API overwhelm while maintaining efficiency

### Intelligent Filtering
- Automatically skips flags with invalid/missing creation dates
- Configurable skip logic for flags with existing expiry properties
- Detailed reporting of why flags were skipped

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

## Error Handling

The action includes comprehensive error handling for:

- **Invalid API credentials** - Clear guidance on token requirements
- **Missing flags** - Graceful handling of flags without creation dates
- **Permission errors** - Specific messaging about write permissions
- **Network connectivity issues** - Automatic retry with exponential backoff
- **Rate limiting** - Built-in 429 handling per LaunchDarkly's guidelines
- **API failures** - Detailed error reporting with context

## Performance & Scale

### Tested At Scale
- ✅ **1000+ flags** - Handles large enterprise projects
- ✅ **Rate limiting** - Respects LaunchDarkly API limits
- ✅ **Memory efficient** - Processes flags in batches
- ✅ **Progress tracking** - Real-time updates for long-running operations

### Typical Performance
- **Small projects** (< 50 flags): ~30 seconds
- **Medium projects** (50-500 flags): 2-5 minutes
- **Large projects** (500+ flags): 5-15 minutes

Performance depends on:
- Number of flags in project
- API response times
- Rate limiting encounters
- Batch size configuration

## Troubleshooting

### Common Issues

1. **"Please check your API key has WRITE permissions"**
   - Ensure your API token has write access to feature flags
   - Verify the token hasn't expired

2. **"Invalid creation date for flag"**
   - Some flags may have missing or invalid creation dates
   - These flags are automatically skipped with detailed reporting

3. **Rate limiting errors**
   - The action handles rate limiting automatically
   - For very large projects, the action may take longer but will complete

4. **"No flags to process"**
   - All flags already have expiry dates (when `skip_existing: true`)
   - Check the skipped flags output for details

### Debug Mode

Enable debug logging by setting the `ACTIONS_STEP_DEBUG` secret to `true` in your repository.

## Integration with Other Tools

### LaunchDarkly Flag Expiry Audit Action
Perfect companion for complete flag lifecycle management:
```yaml
# Set expiry dates
- uses: your-org/launchdarkly-flag-expiry-setter@v1
  # ... configuration ...

# Audit expiring flags
- uses: devopsdina/ld-cp-exp-date-gh-actions-audit@v1
  # ... configuration ...
```

### Slack Notifications
Combine with Slack actions for team notifications:
```yaml
- name: Notify team of flag updates
  uses: 8398a7/action-slack@v3
  with:
    status: custom
    custom_payload: |
      {
        text: "Updated expiry dates on ${{ steps.set-expiry.outputs.total_processed }} flags"
      }
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Related Actions

- [LaunchDarkly Flag Expiry Audit](https://github.com/devopsdina/ld-cp-exp-date-gh-actions-audit) - Audit flags for expiring dates