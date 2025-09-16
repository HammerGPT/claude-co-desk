#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createToolDefinitions } from "./tools.js";
import { setupRequestHandlers } from "./requestHandler.js";
import { ensureConfigDirectories } from "./config.js";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

// Set up logging to a file instead of console
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logDir = path.join(__dirname, '..');
const logFile = path.join(logDir, 'mcp-debug.log');

// Environment variable for debug logging
const DEBUG_MODE = process.env.MCP_DEBUG === 'true';

// Ensure we can write to the log file
try {
  fs.writeFileSync(logFile, `=== MCP Service Starting at ${new Date().toISOString()} ===\n`, { flag: 'a' });
} catch (error) {
  console.error('Cannot write to log file:', error);
}

export function logToFile(message: string): void {
  try {
    fs.appendFileSync(logFile, `${new Date().toISOString()} - ${message}\n`);
    // Only log to console in debug mode
    if (DEBUG_MODE) {
      console.error(`[DEBUG] ${message}`);
    }
  } catch (error) {
    console.error('Log error:', error);
  }
}

/**
 * Main function to run the SMTP MCP server
 */
async function runServer() {
  try {
    logToFile(`[runServer] ===== SMTP MCP SERVER STARTING =====`);
    logToFile(`[runServer] Timestamp: ${new Date().toISOString()}`);
    logToFile(`[runServer] Log file path: ${logFile}`);

    // Ensure config directories exist
    logToFile(`[runServer] Ensuring config directories...`);
    await ensureConfigDirectories();
    logToFile(`[runServer] Config directories ensured`);

    // Initialize the server
    logToFile(`[runServer] Initializing MCP server...`);
    const server = new Server(
      {
        name: "smtp-email-server",
        version: "1.0.0",
        description: "SMTP Email MCP Server with template management"
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // Set error handler
    server.onerror = (error) => logToFile(`[MCP Error] ${error}`);

    // Create tool definitions
    const TOOLS = createToolDefinitions();

    // Setup request handlers
    await setupRequestHandlers(server, TOOLS);

    // Create transport and connect
    logToFile(`[runServer] Creating transport and connecting...`);
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logToFile("[runServer] SMTP MCP Server started successfully");
    logToFile(`[runServer] ===== SMTP MCP SERVER READY =====`);
    
    // Keep the process alive when run directly
    console.log("SMTP MCP Server running. Press Ctrl+C to exit.");
    
    // Handle stdin to keep the process running
    process.stdin.resume();
    
    // Handle process termination
    process.on('SIGINT', () => {
      logToFile("Server shutting down due to SIGINT");
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      logToFile("Server shutting down due to SIGTERM");
      process.exit(0);
    });
    
  } catch (error) {
    logToFile(`Server failed to start: ${error}`);
    process.exit(1);
  }
}

// Run the server
runServer().catch((error) => {
  logToFile(`Server failed to start: ${error}`);
  process.exit(1);
}); 