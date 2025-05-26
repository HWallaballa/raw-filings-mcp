# Raw Filings MCP Python Client

A simple Python client for accessing the Raw Filings MCP API. This client makes it easy to fetch raw SEC filings directly in your Python applications.

## Installation

```bash
pip install git+https://github.com/HWallaballa/raw-filings-mcp.git#subdirectory=sdk/python
```

## Usage

```python
from raw_filings_client import RawFilingsClient

# Create client with your API key
client = RawFilingsClient("your_api_key_here")

# Fetch and save a filing
success = client.save_filing(
    accession="000032019323000064",  # Apple Inc. 10-K
    output_path="apple_10k.txt",
    ticker="AAPL"  # Optional but recommended
)

if success:
    print("Filing saved successfully!")
```

### Using Environment Variables

You can also configure the client using environment variables:

```python
import os
from raw_filings_client import create_client_from_env

# Set environment variables
os.environ["RAW_FILINGS_API_KEY"] = "your_api_key_here"
os.environ["RAW_FILINGS_API_URL"] = "https://api.rawfilings.ai"  # Optional

# Create client from environment
client = create_client_from_env()

# Now use the client
response = client.get_filing("000032019323000064")
```

## Advanced Usage

### Getting the Raw Response

```python
response = client.get_filing(
    accession="000032019323000064",
    ticker="AAPL"
)

# Check status
if response.status_code == 200:
    # Process the content
    content = response.content
    
    # Save to file
    with open("filing.txt", "wb") as f:
        f.write(content)
```

## License

MIT 