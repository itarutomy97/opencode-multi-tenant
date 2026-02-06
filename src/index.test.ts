import { describe, it, expect } from 'vitest';

describe('Dockerデプロイ対応', () => {
  it('Dockerfileが存在する', () => {
    // Arrange & Act
    const fs = require('fs');
    const exists = fs.existsSync('./Dockerfile');

    // Assert
    expect(exists).toBe(true);
  });

  it('docker-compose.ymlが存在する', () => {
    // Arrange & Act
    const fs = require('fs');
    const exists = fs.existsSync('./docker-compose.yml');

    // Assert
    expect(exists).toBe(true);
  });

  it('.dockerignoreが存在する', () => {
    // Arrange & Act
    const fs = require('fs');
    const exists = fs.existsSync('./.dockerignore');

    // Assert
    expect(exists).toBe(true);
  });
});
