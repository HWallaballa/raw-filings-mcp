from setuptools import setup, find_packages

setup(
    name="raw-filings-client",
    version="0.1.0",
    description="Python client for the Raw Filings MCP API",
    author="HWallaballa",
    author_email="yourname@example.com",
    url="https://github.com/HWallaballa/raw-filings-mcp",
    py_modules=["raw_filings_client"],
    install_requires=[
        "requests>=2.25.0",
    ],
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.7",
) 