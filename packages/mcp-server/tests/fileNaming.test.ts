import { describe, it, expect } from 'vitest';
import { suggestFileExtension, SPECIAL_FILENAMES, shouldHaveExtension } from '../src/tools/fileNaming';

describe('File Naming', () => {
  describe('SPECIAL_FILENAMES', () => {
    it('should include common special filenames without extensions', () => {
      expect(SPECIAL_FILENAMES).toContain('.env');
      expect(SPECIAL_FILENAMES).toContain('Makefile');
      expect(SPECIAL_FILENAMES).toContain('Dockerfile');
      expect(SPECIAL_FILENAMES).toContain('README');
    });
  });

  describe('shouldHaveExtension', () => {
    it('should return false for special filenames', () => {
      expect(shouldHaveExtension('.env')).toBe(false);
      expect(shouldHaveExtension('Makefile')).toBe(false);
      expect(shouldHaveExtension('Dockerfile')).toBe(false);
      expect(shouldHaveExtension('README')).toBe(false);
    });

    it('should return true for regular filenames without extension', () => {
      expect(shouldHaveExtension('guide')).toBe(true);
      expect(shouldHaveExtension('index')).toBe(true);
      expect(shouldHaveExtension('main')).toBe(true);
    });

    it('should return false for filenames with extension', () => {
      expect(shouldHaveExtension('guide.md')).toBe(false);
      expect(shouldHaveExtension('index.html')).toBe(false);
      expect(shouldHaveExtension('main.py')).toBe(false);
    });
  });

  describe('suggestFileExtension', () => {
    it('should suggest .md for Markdown content', () => {
      const content = '# Heading\n\nThis is markdown';
      expect(suggestFileExtension('notes', content)).toBe('.md');
    });

    it('should suggest .md for markdown with frontmatter', () => {
      const content = '---\ntitle: Test\n---\n\n# Content';
      expect(suggestFileExtension('doc', content)).toBe('.md');
    });

    it('should suggest .html for HTML content', () => {
      const content = '<!DOCTYPE html><html></html>';
      expect(suggestFileExtension('page', content)).toBe('.html');
    });

    it('should suggest .html for html without doctype', () => {
      const content = '<html><body>Hello</body></html>';
      expect(suggestFileExtension('index', content)).toBe('.html');
    });

    it('should suggest .py for Python code', () => {
      const content = 'def hello():\n    return "world"';
      expect(suggestFileExtension('script', content)).toBe('.py');
    });

    it('should suggest .py for Python with shebang', () => {
      const content = '#!/usr/bin/env python\nprint("hello")';
      expect(suggestFileExtension('script', content)).toBe('.py');
    });

    it('should suggest .js for JavaScript code', () => {
      const content = 'const x = 1;\nfunction test() {}';
      expect(suggestFileExtension('app', content)).toBe('.js');
    });

    it('should suggest .json for JSON content', () => {
      const content = '{"key": "value", "num": 123}';
      expect(suggestFileExtension('config', content)).toBe('.json');
    });

    it('should suggest .yaml for YAML content', () => {
      const content = 'key: value\nlist:\n  - item1\n  - item2';
      expect(suggestFileExtension('config', content)).toBe('.yaml');
    });

    it('should suggest .css for CSS content', () => {
      const content = '.class { color: red; }';
      expect(suggestFileExtension('style', content)).toBe('.css');
    });

    it('should suggest .sh for shell script', () => {
      const content = '#!/bin/bash\necho "hello"';
      expect(suggestFileExtension('script', content)).toBe('.sh');
    });

    it('should suggest .ts for TypeScript code', () => {
      const content = 'const x: number = 1;\ninterface User {}';
      expect(suggestFileExtension('app', content)).toBe('.ts');
    });

    it('should return null for plain text', () => {
      const content = 'Just some plain text without any specific format';
      expect(suggestFileExtension('notes', content)).toBe(null);
    });

    it('should return null for special filenames', () => {
      expect(suggestFileExtension('.env', 'KEY=value')).toBe(null);
      expect(suggestFileExtension('Makefile', 'all: build')).toBe(null);
    });

    it('should return null for empty content', () => {
      expect(suggestFileExtension('file', '')).toBe(null);
    });
  });
});
