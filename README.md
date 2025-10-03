# LaunchDarkly Flag Expiry Setter Action

A GitHub Action that sets expiry date custom properties on LaunchDarkly feature flags. This action helps teams proactively manage feature flag lifecycle by setting expiration dates that can later be monitored by audit tools.

## Features

- 🎯 **Targeted Flag Updates**: Set expiry dates on specific flags by providing flag keys
- 📅 **Flexible Date Formats**: Supports multiple date formats (MM/DD/YYYY, YYYY-MM-DD, etc.)
- 🔧 **Configurable Property Names**: Use custom property names or the default `flag.expiry.date`
- ⚡ **Batch Processing**: Process multiple flags in a single action run
- 📊 **Detailed Reporting**: Comprehensive success/failure reporting with summaries
- 🛡️ **Error Handling**: Robust error handling with specific guidance for common issues
- 📝 **Auto-dating**: Defaults to today's date if no expiry date is specified

## Usage

This is not an officially supported solution.  Use at your own risk.

### Basic Example

```yaml
name: Set Flag Expiry Dates
on:
  workflow_dispatch:
    inputs:
      flag_keys:
        description: 'Comma-separated flag keys'
        required: true
        default: 'my-feature-flag,another-flag'
      expiry_date:
        description: 'Expiry date (MM/DD/YYYY)'
        required: false

jobs:
  set-expiry-dates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set LaunchDarkly Flag Expiry Dates
        uses: your-org/launchdarkly-flag-expiry-setter@v1
        with:
          launchdarkly_api_key: ${{ secrets.LAUNCHDARKLY_API_KEY }}
          project_key: 'your-project-key'
          flag_keys: ${{ github.event.inputs.flag_keys }}
          expiry_date: ${{ github.event.inputs.expiry_date }}
```

### Set Expiry Date to Today

```yaml
name: Mark Flags for Immediate Expiry
on:
  workflow_dispatch:
    inputs:
      flag_keys:
        description: 'Flags to expire today'
        required: true

jobs:
  expire-flags:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set flags to expire today
        uses: your-org/launchdarkly-flag-expiry-setter@v1
        with:
          launchdarkly_api_key: ${{ secrets.LAUNCHDARKLY_API_KEY }}
          project_key: 'your-project-key'
          flag_keys: ${{ github.event.inputs.flag_keys }}
          # expiry_date not specified = defaults to today
```

### Custom Date Format and Property Name

```yaml
name: Set Custom Expiry Properties
on:
  workflow_dispatch:

jobs:
  set-custom-expiry:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set custom expiry properties
        uses: your-org/launchdarkly-flag-expiry-setter@v1
        with:
          launchdarkly_api_key: ${{ secrets.LAUNCHDARKLY_API_KEY }}
          project_key: 'your-project-key'
          flag_keys: 'feature-a,feature-b,feature-c'
          expiry_date: '2024-12-31'
          date_format: 'YYYY-MM-DD'
          custom_property_name: 'custom.expiry.date'
```

### Integration with Pull Request Workflow

```yaml
name: Set Expiry on New Features
on:
  pull_request:
    types: [opened, synchronize]
    paths:
      - 'features/**'

jobs:
  set-feature-expiry:
    runs-on: ubuntu-latest
    if: contains(github.event.pull_request.title, '[FEATURE]')
    steps:
      - uses: actions/checkout@v4
      
      - name: Extract flag keys from PR
        id: extract-flags
        run: |
          # Extract flag keys from PR description or files
          FLAGS=$(grep -r "launchDarkly\|ld\." features/ | grep -o "flag-[a-zA-Z0-9-]*" | sort -u | tr '\n' ',' | sed 's/,$//')
          echo "flag_keys=$FLAGS" >> $GITHUB_OUTPUT
      
      - name: Set 30-day expiry on new feature flags
        if: steps.extract-flags.outputs.flag_keys != ''
        uses: your-org/launchdarkly-flag-expiry-setter@v1
        with:
          launchdarkly_api_key: ${{ secrets.LAUNCHDARKLY_API_KEY }}
          project_key: 'your-project-key'
          flag_keys: ${{ steps.extract-flags.outputs.flag_keys }}
          expiry_date: ${{ steps.calculate-expiry.outputs.date }}
      
      - name: Calculate expiry date (30 days from now)
        id: calculate-expiry
        run: |
          EXPIRY_DATE=$(date -d "+30 days" +"%m/%d/%Y")
          echo "date=$EXPIRY_DATE" >> $GITHUB_OUTPUT
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `launchdarkly_api_key` | LaunchDarkly API access token (requires WRITE permission) | Yes | |
| `project_key` | LaunchDarkly project key | Yes | |
| `flag_keys` | Comma-separated list of flag keys to set expiry dates on | Yes | |
| `custom_property_name` | Name of the custom property to set | No | `flag.expiry.date` |
| `expiry_date` | Expiry date to set (defaults to today if not specified) | No | Today's date |
| `date_format` | Date format for the expiry date | No | `MM/DD/YYYY` |

## Outputs

| Output | Description |
|--------|-------------|
| `updated_flags` | JSON array of flags that were successfully updated |
| `failed_flags` | JSON array of flags that failed to update |
| `total_processed` | Total number of flags processed |

### Output Format

#### Successfully Updated Flags
```json
[
  {
    "key": "my-feature-flag",
    "name": "My Feature Flag",
    "customPropertyName": "flag.expiry.date",
    "expiryDate": "03/15/2024",
    "dateFormat": "MM/DD/YYYY"
  }
]
```

#### Failed Flags
```json
[
  {
    "key": "non-existent-flag",
    "error": "Flag not found: non-existent-flag"
  }
]
```

## Supported Date Formats

The action supports multiple date formats:

- `MM/DD/YYYY` (e.g., `03/15/2024`) - **Default**
- `MM-DD-YYYY` (e.g., `03-15-2024`)
- `YYYY-MM-DD` (e.g., `2024-03-15`)
- `YYYY/MM/DD` (e.g., `2024/03/15`)

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

## Error Handling

The action includes comprehensive error handling for:

- **Invalid API credentials** - Clear guidance on token requirements
- **Missing flags** - Identifies which flags don't exist
- **Permission errors** - Specific messaging about write permissions
- **Network connectivity issues** - Retry guidance for transient failures
- **Invalid date formats** - Validation with format examples
- **API rate limiting** - Automatic handling with appropriate delays

## Common Use Cases

### 1. Feature Flag Lifecycle Management
Set expiry dates when creating new feature flags to ensure they don't become permanent.

### 2. Cleanup Campaigns
Batch set expiry dates on existing flags during cleanup initiatives.

### 3. Release Management
Set expiry dates based on release cycles (e.g., 30 days after deployment).

### 4. Compliance Requirements
Ensure all feature flags have expiry dates for audit and compliance purposes.

### 5. Integration with Audit Tools
Use in combination with the [LaunchDarkly Flag Expiry Audit Action](https://github.com/your-org/launchdarkly-flag-expiry-audit) for complete lifecycle management.

## Integration Pattern

This action works perfectly with the audit action for complete flag lifecycle management:

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
      - name: Find flags without expiry dates
        # Custom logic to identify flags needing expiry dates
        
      - name: Set expiry dates
        uses: your-org/launchdarkly-flag-expiry-setter@v1
        with:
          launchdarkly_api_key: ${{ secrets.LAUNCHDARKLY_API_KEY }}
          project_key: 'your-project'
          flag_keys: ${{ steps.find-flags.outputs.flag_keys }}

  # Then, audit for expiring flags
  audit-expiring:
    runs-on: ubuntu-latest
    needs: set-missing-expiry
    steps:
      - name: Audit expiring flags
        uses: your-org/launchdarkly-flag-expiry-audit@v1
        with:
          launchdarkly_api_key: ${{ secrets.LAUNCHDARKLY_API_KEY }}
          project_key: 'your-project'
          days_ahead: '7'
          create_issues: 'true'
```

## Troubleshooting

### Common Issues

1. **"Please check your API key has WRITE permissions"**
   - Ensure your API token has write access to feature flags
   - Verify the token hasn't expired

2. **"Flag not found"**
   - Check that the flag key exists in the specified project
   - Verify the project key is correct

3. **"Invalid date format"**
   - Ensure the date matches the specified format exactly
   - Use the `date_format` input to specify the correct format

4. **Rate limiting errors**
   - The action handles rate limiting automatically
   - For large batches, consider splitting into smaller runs

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Related Actions

- [LaunchDarkly Flag Expiry Audit](https://github.com/devopsdina/ld-cp-exp-date-gh-actions-audit) - Audit flags for expiring dates
