import { pathsToModuleNameMapper } from "ts-jest";
import { compilerOptions } from "../../tsconfig.json";

export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../../',
  testRegex: ".e2e-spec.ts$",
  moduleDirectories: ["node_modules", "<rootDir>"],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/'
  }),
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  setupFiles: ['dotenv/config']
}