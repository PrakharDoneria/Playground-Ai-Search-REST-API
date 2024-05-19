# Playground Search API

This project provides a simple HTTP API to perform search queries using Deno.

## Prerequisites

- [Deno](https://deno.land/) installed.

## Setup

### Clone the Repository

First, clone the repository to your local machine:

```sh
git clone https://github.com/PrakharDoneria/Playground-Ai-Search-REST-API.git
cd Playground-Ai-Search-REST-API
```

### Install Dependencies

Deno manages dependencies via URLs, so there are no additional steps needed for installation beyond cloning the repository.

## Build the Project

Since Deno is interpreted and runs TypeScript natively, there's no traditional build step required. However, you can use the following commands to check your code formatting and linting:

- **Format code**:
    ```sh
    deno fmt
    ```

- **Lint code**:
    ```sh
    deno lint
    ```

## Run the Server

To start the server, run the following command:

```sh
deno task start
```

This command will start the HTTP server, and you should see the following output indicating that the server is running:

```
HTTP webserver running. Access it at: http://localhost:8000/
```

## Usage

To perform a search, send a GET request to the `/search` endpoint with a query parameter `q`.

### Example

You can use `curl` to test the endpoint:

```sh
curl "http://localhost:8000/search?q=test"
```

### Response

The API will return a JSON response with the search results. If no results are found, or if there is an error, appropriate error messages will be returned.

## Directory Structure

The project directory is structured as follows:

```
Playground-Ai-Search-REST-API/
│
├── index.ts
├── deno.json
└── README.md
```

### `index.ts`

This is the main file containing the server code. It sets up an HTTP server and handles search requests.

### `.gitignore`

Specifies files and directories that should be ignored by Git.

### `deno.json`

Configuration file for Deno, defining custom tasks, formatting options, and linting rules.

### `README.md`

This file. Provides an overview of the project, setup instructions, and usage examples.

## Configuration

The project uses a `deno.json` file for configuration. This includes custom tasks, formatting options, and linting rules.

### `deno.json`

```json
{
  "tasks": {
    "start": "deno run --allow-net index.ts"
  },
  "fmt": {
    "options": {
      "useTabs": false,
      "lineWidth": 80,
      "indentWidth": 2,
      "singleQuote": true,
      "proseWrap": "always"
    }
  },
  "lint": {
    "rules": {
      "tags": ["recommended"]
    }
  }
}
```

