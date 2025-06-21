import { TypeDefinition } from "./types";
/**
 * Registry for custom types that need special serialization handling.
 * Handles complex objects like Sets, Maps, and other non-JSON-serializable types.
 *
 * @example
 * ```typescript
 * const registry = new TypeRegistry();
 * registry.register({
 *   typeName: 'Date',
 *   isType: (value) => value instanceof Date,
 *   serialize: (date) => date.toISOString(),
 *   deserialize: (str) => new Date(str)
 * });
 * ```
 */
export class TypeRegistry {
  private types: TypeDefinition<any>[] = [];

  constructor() {
    // Initialize with built-in types
    this.register<Set<any>>({
      typeName: "Set",
      isType: (value): value is Set<any> => value instanceof Set,
      serialize: set => Array.from(set),
      deserialize: data => new Set(data),
    });

    this.register<Map<any, any>>({
      typeName: "Map",
      isType: (value): value is Map<any, any> => value instanceof Map,
      serialize: map => Array.from(map.entries()),
      deserialize: data => new Map(data),
    });
  }

  /**
   * Register a new type definition for custom serialization
   * @param typeDef - The type definition to register
   */
  register<T>(typeDef: TypeDefinition<T>): void {
    this.types.push(typeDef);
  }

  /**
   * Find the appropriate type definition for a value
   * @param value - The value to find a type definition for
   * @returns The matching type definition or null if none found
   */
  findTypeFor(value: any): TypeDefinition<any> | null {
    for (const type of this.types) {
      if (type.isType(value)) {
        return type;
      }
    }
    return null;
  }

  /**
   * Serialize a value with appropriate type handling
   * @param value - The value to serialize
   * @returns The serialized value with type information preserved
   */
  serialize(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    const typeDef = this.findTypeFor(value);
    if (typeDef) {
      return {
        __type: typeDef.typeName,
        data: typeDef.serialize(value),
      };
    }

    // Handle plain objects and arrays recursively
    if (Array.isArray(value)) {
      return value.map(item => this.serialize(item));
    }

    if (typeof value === "object") {
      const result: Record<string, any> = {};
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          result[key] = this.serialize(value[key]);
        }
      }
      return result;
    }

    // Primitives are returned as-is
    return value;
  }

  /**
   * Deserialize a value with appropriate type handling
   * @param value - The value to deserialize
   * @returns The deserialized value with proper types restored
   */
  deserialize(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Check for type markers
    if (typeof value === "object" && value.__type) {
      const typeDef = this.types.find(t => t.typeName === value.__type);
      if (typeDef) {
        return typeDef.deserialize(value.data);
      }
    }

    // Handle arrays recursively
    if (Array.isArray(value)) {
      return value.map(item => this.deserialize(item));
    }

    // Handle plain objects recursively
    if (typeof value === "object") {
      const result: Record<string, any> = {};
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          result[key] = this.deserialize(value[key]);
        }
      }
      return result;
    }

    // Primitives are returned as-is
    return value;
  }
}
