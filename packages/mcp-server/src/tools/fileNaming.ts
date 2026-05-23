/**
 * File naming utilities for MCP Server
 * Helps suggest appropriate file extensions based on content
 */

/** Special filenames that don't need extensions */
export const SPECIAL_FILENAMES = new Set([
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  '.gitignore',
  '.gitattributes',
  '.gitmodules',
  '.dockerignore',
  '.npmignore',
  '.prettierignore',
  '.eslintignore',
  '.editorconfig',
  'Makefile',
  'makefile',
  'GNUmakefile',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'README',
  'README.txt',
  'LICENSE',
  'LICENSE.txt',
  'CHANGELOG',
  'CHANGELOG.txt',
  'CONTRIBUTING',
  'CONTRIBUTING.txt',
  'CNAME',
  'Vagrantfile',
  'Rakefile',
  'Gemfile',
  'Capfile',
  'Guardfile',
  'Podfile',
  'Berksfile',
  'Thorfile',
  'config.ru',
  'CMakeLists.txt',
  'requirements.txt',
  'Pipfile',
  'Pipfile.lock',
  'poetry.lock',
  'Cargo.toml',
  'Cargo.lock',
  'go.mod',
  'go.sum',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'jsconfig.json',
  'composer.json',
  'composer.lock',
  'yarn.lock',
  'pnpm-lock.yaml',
  'deno.lock',
  '.babelrc',
  '.eslintrc',
  '.prettierrc',
  '.prettierrc.json',
  '.eslintrc.json',
  'tailwind.config.js',
  'vite.config.ts',
  'vitest.config.ts',
  'jest.config.js',
  'webpack.config.js',
  'rollup.config.js',
  'esbuild.config.js',
  'postcss.config.js',
  'vue.config.js',
  'nuxt.config.js',
  'next.config.js',
  'gatsby-config.js',
  'remix.config.js',
  'astro.config.mjs',
  'svelte.config.js',
  '.htaccess',
  'nginx.conf',
  'robots.txt',
]);

/**
 * Check if a filename is a special filename that doesn't need an extension
 */
export function isSpecialFilename(filename: string): boolean {
  const baseName = filename.split('/').pop() || filename;

  // Exact match
  if (SPECIAL_FILENAMES.has(baseName)) {
    return true;
  }

  // Pattern match for .env.* files
  if (baseName.startsWith('.env.')) {
    return true;
  }

  return false;
}

/**
 * Check if a filename should have an extension
 * @returns true if the filename should have an extension but doesn't
 */
export function shouldHaveExtension(filename: string): boolean {
  // If it already has an extension, no need to suggest
  if (filename.includes('.')) {
    return false;
  }

  // Special filenames don't need extensions
  if (isSpecialFilename(filename)) {
    return false;
  }

  return true;
}

/**
 * Suggest an appropriate file extension based on content
 * @param filename - The filename without extension
 * @param content - The file content
 * @returns Suggested extension (including the dot) or null if can't determine
 */
export function suggestFileExtension(filename: string, content: string): string | null {
  // Don't suggest for special filenames
  if (isSpecialFilename(filename)) {
    return null;
  }

  // If already has extension, don't suggest
  if (filename.includes('.')) {
    return null;
  }

  // Empty content
  if (!content || content.trim().length === 0) {
    return null;
  }

  const trimmedContent = content.trim();
  const firstLine = trimmedContent.split('\n')[0].toLowerCase();
  const firstFewLines = trimmedContent.split('\n').slice(0, 5).join('\n');

  // Markdown detection
  // Check for markdown patterns
  if (
    firstLine.startsWith('# ') ||
    firstLine.startsWith('## ') ||
    firstLine.startsWith('### ') ||
    firstLine.startsWith('---') || // YAML frontmatter
    /^\[.+\]:\s*http/.test(firstLine) || // Link definitions
    /\[.+\]\(.+\)/.test(firstFewLines) || // Links [text](url)
    /\*\*.+\*\*/.test(firstFewLines) || // Bold **text**
    /__.+__/.test(firstFewLines) || // Bold __text__
    /\*.+\*/.test(firstFewLines) || // Italic *text*
    /_.+_/.test(firstFewLines) || // Italic _text_
    /^\s*-\s/.test(firstFewLines) || // Unordered list
    /^\s*\*\s/.test(firstFewLines) || // Unordered list with asterisk
    /^\s*\d+\.\s/.test(firstFewLines) || // Ordered list
    /^\s*```/.test(firstFewLines) || // Code block
    /^\|.+\|/.test(firstFewLines) // Table
  ) {
    return '.md';
  }

  // HTML detection
  if (
    firstLine.startsWith('<!doctype html>') ||
    firstLine.startsWith('<!DOCTYPE html>') ||
    firstLine.startsWith('<html') ||
    firstLine.startsWith('<HTML') ||
    (firstLine.startsWith('<') && firstLine.includes('</'))
  ) {
    return '.html';
  }

  // Python detection
  if (
    firstLine.startsWith('#!/usr/bin/env python') ||
    firstLine.startsWith('#!/usr/bin/python') ||
    firstLine.startsWith('# -*- coding:') ||
    /^(def |class |import |from )/.test(firstFewLines)
  ) {
    return '.py';
  }

  // TypeScript detection (must check before JavaScript)
  if (
    /:\s*(string|number|boolean|any|void|never)\b/.test(firstFewLines) || // Type annotations
    /^(interface |type\s+\w+\s*=)/m.test(firstFewLines) || // interface/type
    /^(export |import )/.test(firstFewLines)
  ) {
    return '.ts';
  }

  // JavaScript detection
  if (
    firstLine.startsWith('#!/usr/bin/env node') ||
    /^(const |let |var |function |=>)/m.test(firstFewLines) ||
    /^(export |import )/.test(firstFewLines) ||
    /^(class |async |await )/m.test(firstFewLines)
  ) {
    return '.js';
  }

  // JSON detection
  try {
    JSON.parse(trimmedContent);
    return '.json';
  } catch {
    // Not valid JSON, continue
  }

  // YAML detection
  if (
    /^[\w-]+:\s*.+/m.test(firstFewLines) && // key: value pattern
    !firstLine.startsWith('{') && // Not JSON object
    !/^(\{|\[)/.test(firstLine)
  ) {
    // Check for YAML-specific patterns
    const yamlPatterns = [
      /^\s*-\s+\w+:/m, // List with nested objects
      /^\w+:\s*$/m, // Keys with empty values (common in YAML)
      /^\s+\w+:\s+/m, // Indented keys
    ];

    if (yamlPatterns.some(pattern => pattern.test(firstFewLines))) {
      return '.yaml';
    }
  }

  // CSS detection
  if (
    /^(\.[a-zA-Z_-][\w-]*\s*\{|@media|@import|body\s*\{|html\s*\{)/m.test(firstFewLines) ||
    /\{[^}]*:[^}]*\}/.test(firstFewLines)
  ) {
    return '.css';
  }

  // Shell script detection
  if (
    firstLine.startsWith('#!/bin/bash') ||
    firstLine.startsWith('#!/bin/sh') ||
    firstLine.startsWith('#!/usr/bin/env bash')
  ) {
    return '.sh';
  }

  // Go detection
  if (
    /^package\s+\w+/m.test(firstFewLines) ||
    /^func\s+\w+/m.test(firstFewLines) ||
    /^import\s+\(/m.test(firstFewLines)
  ) {
    return '.go';
  }

  // Rust detection
  if (
    /^fn\s+\w+/m.test(firstFewLines) ||
    /^use\s+\w+/m.test(firstFewLines) ||
    /^mod\s+\w+/m.test(firstFewLines) ||
    /^impl/m.test(firstFewLines)
  ) {
    return '.rs';
  }

  // Java detection
  if (
    /^public\s+class/m.test(firstFewLines) ||
    /^package\s+\w+/m.test(firstFewLines)
  ) {
    return '.java';
  }

  // PHP detection
  if (firstLine.includes('<?php') || firstLine.includes('<?=')) {
    return '.php';
  }

  // XML detection
  if (firstLine.startsWith('<?xml')) {
    return '.xml';
  }

  // SQL detection
  if (
    /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s+/i.test(firstFewLines)
  ) {
    return '.sql';
  }

  // Dockerfile detection
  if (
    /^FROM\s+/i.test(firstLine) ||
    /^RUN\s+/i.test(firstLine) ||
    /^COPY\s+/i.test(firstLine)
  ) {
    // This is likely a Dockerfile content but being saved with wrong name
    return null; // We shouldn't suggest extension for this
  }

  // Plain text - no suggestion
  return null;
}

/**
 * Generate a user-friendly suggestion message
 */
export function generateSuggestionMessage(filename: string, content: string): string | null {
  if (!shouldHaveExtension(filename)) {
    return null;
  }

  const extension = suggestFileExtension(filename, content);
  if (!extension) {
    return null;
  }

  return `Tip: Consider renaming "${filename}" to "${filename}${extension}" for better rendering`;
}
