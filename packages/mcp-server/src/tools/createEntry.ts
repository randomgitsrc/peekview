import { z } from 'zod';
import type { PeekViewClient } from '../client.js';
import type { SessionContext, ToolDefinition, ToolResult } from '../types.js';
import { translateError } from './utils.js';
import { shouldHaveExtension, suggestFileExtension, isSpecialFilename } from './fileNaming.js';

const schema = z.object({
  summary: z.string().min(1),
  files: z.array(z.object({
    filename: z.string().min(1),
    content: z.string(),
    path: z.string().optional(),
  })).min(1),
  slug: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_public: z.boolean().optional(),
  expires_in: z.string().optional(),
});

export const createEntryTool = (client: PeekViewClient, publicUrl: string): ToolDefinition => ({
  name: 'create_entry',
  description: `Create a new PeekView entry with files. Returns the entry URL.

Best practices for filenames:
- Markdown documents: use .md extension (e.g., "readme.md", "guide.md")
- HTML pages: use .html extension (e.g., "index.html", "demo.html")
- Code files: use appropriate extension (e.g., ".py", ".js", ".ts", ".go")
- Config files: use .json, .yaml, .toml as appropriate
- Special files can omit extension: .env, Makefile, Dockerfile, README

The tool will suggest appropriate extensions if missing.

Examples:
- Create Markdown doc: {"summary": "API Guide", "files": [{"filename": "api-guide.md", "content": "# API..."}]}
- Create HTML demo: {"summary": "Chart Demo", "files": [{"filename": "index.html", "content": "<!DOCTYPE html>..."}, {"filename": "style.css", "content": "..."}]}
- Create code snippet: {"summary": "Fix for bug #123", "files": [{"filename": "fix.py", "content": "def fix():..."}]}
- Create private entry: {"summary": "Internal notes", "files": [...], "is_public": false}
- Multi-file with paths: {"summary": "Project", "files": [{"filename": "main.py", "path": "src", "content": "..."}, {"filename": "README.md", "content": "..."}]}
- With expiration: {"summary": "Temp report", "files": [...], "expires_in": "7d"}
- No expiration: {"summary": "Permanent", "files": [...], "expires_in": "0"}

Default: If expires_in is omitted, the server's default expiration applies. Check /api/v1/config/limits for current setting.`,
  inputSchema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Entry summary/description' },
      files: {
        type: 'array',
        description: 'Files to include. Markdown/HTML/Code files should have extensions (.md, .html, .py, etc.) for proper rendering',
        items: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'Filename (e.g., "readme.md", "index.html", "main.py", ".env", "Makefile")'
            },
            content: { type: 'string' },
            path: {
              type: 'string',
              description: 'Optional subdirectory path (e.g., "src", "docs") for organizing multi-file entries'
            },
          },
          required: ['filename', 'content'],
        },
      },
      slug: { type: 'string', description: 'Custom URL slug (auto-generated if not provided)' },
      tags: { type: 'array', items: { type: 'string' } },
      is_public: { type: 'boolean', description: 'Whether entry is public (default: true)' },
      expires_in: { type: 'string', description: 'Expiration duration (e.g., "7d", "1h"). Default: configured on server. Use "0" for no expiration.' },
    },
    required: ['summary', 'files'],
  },
  handler: async (args: unknown, ctx: SessionContext): Promise<ToolResult> => {
    try {
      const params = schema.parse(args);

      // Check for files that might benefit from having extensions
      const suggestions: string[] = [];
      for (const file of params.files) {
        if (shouldHaveExtension(file.filename)) {
          const ext = suggestFileExtension(file.filename, file.content);
          if (ext) {
            suggestions.push(`  - "${file.filename}" → "${file.filename}${ext}"`);
          }
        }
      }

      // Create the entry
      const entry = await client.createEntry({
        summary: params.summary,
        files: params.files,
        slug: params.slug,
        tags: params.tags,
        is_public: params.is_public,
        expires_in: params.expires_in,
      }, ctx.userToken);

      // Build response with optional suggestions
      let responseText = `✓ Entry created successfully

Title: ${entry.summary}
URL: ${publicUrl}/${entry.slug}
Slug: ${entry.slug}
Files: ${entry.files.length}
Visibility: ${entry.is_public ? 'public' : 'private'}
Created: ${entry.created_at}`;

      if (entry.expires_at) {
        const expiresDate = new Date(entry.expires_at);
        responseText += `\nExpires: ${expiresDate.toISOString().slice(0, 10)}`;
      } else {
        responseText += `\nExpires: never`;
      }

      if (suggestions.length > 0) {
        responseText += `\n\n💡 Tip: Consider adding extensions for better rendering:\n${suggestions.join('\n')}`;
      }

      return {
        content: [{
          type: 'text',
          text: responseText,
        }],
      };
    } catch (error) {
      return translateError(error, 'create entry');
    }
  },
});