"""
Raw Filings MCP Client - Simple Python SDK for accessing SEC filings
"""

import os
import requests
from typing import Optional, Union, BinaryIO, Dict, Any


class RawFilingsClient:
    """Client for the Raw Filings MCP API that provides easy access to SEC filings."""
    
    def __init__(self, api_key: str, base_url: str = "https://api.rawfilings.ai"):
        """
        Initialize the Raw Filings client.
        
        Args:
            api_key: Your API key for the Raw Filings MCP
            base_url: The base URL of the API (default: https://api.rawfilings.ai)
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.headers = {
            "x-api-key": api_key,
            "User-Agent": "RawFilingsClient/1.0 Python"
        }
    
    def get_filing(self, 
                  accession: str, 
                  ticker: Optional[str] = None, 
                  cik: Optional[str] = None) -> requests.Response:
        """
        Fetch a raw SEC filing by accession number.
        
        Args:
            accession: The SEC accession number without dashes (required)
            ticker: The company ticker symbol (optional)
            cik: The CIK number (optional)
            
        Returns:
            A requests Response object containing the filing content
        
        Example:
            >>> client = RawFilingsClient("your_api_key")
            >>> response = client.get_filing("000032019323000064", ticker="AAPL")
            >>> with open("apple_filing.txt", "wb") as f:
            >>>     f.write(response.content)
        """
        params = {"accession": accession}
        if ticker:
            params["ticker"] = ticker
        if cik:
            params["cik"] = cik
            
        url = f"{self.base_url}/filing"
        response = requests.get(url, params=params, headers=self.headers)
        
        if response.status_code != 200:
            try:
                error = response.json()
                print(f"Error {response.status_code}: {error.get('message', 'Unknown error')}")
            except:
                print(f"Error {response.status_code}: Could not retrieve filing")
        
        return response
    
    def save_filing(self, 
                   accession: str, 
                   output_path: str,
                   ticker: Optional[str] = None, 
                   cik: Optional[str] = None) -> bool:
        """
        Fetch and save a filing directly to a file.
        
        Args:
            accession: The SEC accession number without dashes
            output_path: Where to save the filing
            ticker: The company ticker symbol (optional)
            cik: The CIK number (optional)
            
        Returns:
            True if successful, False otherwise
            
        Example:
            >>> client = RawFilingsClient("your_api_key")
            >>> success = client.save_filing("000032019323000064", "apple_10k.txt")
        """
        response = self.get_filing(accession, ticker, cik)
        
        if response.status_code == 200:
            with open(output_path, "wb") as f:
                f.write(response.content)
            return True
        return False


# Helper function to create a client from environment variables
def create_client_from_env() -> RawFilingsClient:
    """
    Create a client using the API_KEY environment variable.
    
    Returns:
        A configured RawFilingsClient
        
    Raises:
        ValueError: If the API_KEY environment variable is not set
    """
    api_key = os.environ.get("RAW_FILINGS_API_KEY")
    if not api_key:
        raise ValueError("RAW_FILINGS_API_KEY environment variable not set")
    
    base_url = os.environ.get("RAW_FILINGS_API_URL", "https://api.rawfilings.ai")
    return RawFilingsClient(api_key, base_url) 