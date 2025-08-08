/**
 * Comprehensive test state interface for advanced updatePath functionality
 * Covers various data structures, nesting levels, and type scenarios
 */
export interface UpdatePathTestState {
  // Primitive values for basic path updates
  primitives: {
    stringValue: string
    numberValue: number
    booleanValue: boolean
    nullableString: string | null
    optionalNumber?: number
  }

  // Nested objects with various depths
  user: {
    id: number
    profile: {
      name: string
      email: string
      settings: {
        theme: 'light' | 'dark' | 'auto'
        notifications: {
          email: boolean
          push: boolean
          sms: boolean
        }
        privacy: {
          visibility: 'public' | 'private' | 'friends'
          dataSharing: boolean
        }
      }
      metadata?: {
        lastLogin: number
        loginCount: number
        preferences: Record<string, any>
      }
    }
    permissions: string[]
    roles: Set<string>
  }

  // Arrays with different element types
  collections: {
    simpleArray: string[]
    numberArray: number[]
    objectArray: Array<{
      id: string
      title: string
      completed: boolean
      tags: string[]
      priority: 'low' | 'medium' | 'high'
      metadata?: {
        createdAt: number
        updatedAt?: number
      }
    }>
    nestedArrays: string[][]
    mixedArray: Array<string | number | {type: string; value: any}>
  }

  // Complex data structures
  dataStructures: {
    userMap: Map<
      string,
      {
        name: string
        age: number
        active: boolean
      }
    >
    tagSet: Set<string>
    counters: Record<string, number>
    configuration: {
      [key: string]: {
        value: any
        type: 'string' | 'number' | 'boolean' | 'object'
        required: boolean
        validation?: {
          min?: number
          max?: number
          pattern?: string
        }
      }
    }
  }

  // UI state for dynamic updates
  ui: {
    loading: boolean
    errors: string[]
    modals: {
      [modalId: string]: {
        isOpen: boolean
        data?: any
        position?: {x: number; y: number}
      }
    }
    forms: {
      [formId: string]: {
        values: Record<string, any>
        errors: Record<string, string>
        touched: Record<string, boolean>
        isValid: boolean
      }
    }
    navigation: {
      currentRoute: string
      history: string[]
      breadcrumbs: Array<{
        label: string
        path: string
        isActive: boolean
      }>
    }
  }

  // Application data with complex relationships
  application: {
    projects: Array<{
      id: string
      name: string
      status: 'active' | 'completed' | 'archived'
      team: {
        lead: string
        members: string[]
        collaborators: Set<string>
      }
      tasks: Array<{
        id: string
        title: string
        assignee?: string
        status: 'todo' | 'in-progress' | 'review' | 'done'
        dependencies: string[]
        comments: Array<{
          id: string
          author: string
          content: string
          timestamp: number
          reactions: Map<string, number>
        }>
      }>
      metadata: {
        createdAt: number
        updatedAt: number
        version: number
        settings: Record<string, any>
      }
    }>
  }

  // Runtime dynamic data
  dynamic: {
    cache: Map<
      string,
      {
        data: any
        timestamp: number
        ttl?: number
      }
    >
    subscriptions: Set<string>
    eventHandlers: Record<
      string,
      Array<{
        id: string
        handler: string // In real app this would be a function
        priority: number
      }>
    >
    computed: {
      [key: string]: {
        value: any
        dependencies: string[]
        lastComputed: number
        isStale: boolean
      }
    }
  }

  // Special cases for edge testing
  edgeCases: {
    emptyObject: {}
    emptyArray: []
    emptyMap: Map<string, any>
    emptySet: Set<any>
    nullValue: null
    undefinedValue?: any
    circularRef?: any // Would be handled specially in tests
    deepNesting: {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                value: string
                data: number[]
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Initial test state for comprehensive updatePath functionality testing.
 * Provides realistic data structures that mirror actual application usage patterns.
 */
export const createUpdatePathInitialState = (): UpdatePathTestState => ({
  // Primitive values for basic path updates
  primitives: {
    stringValue: 'initial-string',
    numberValue: 42,
    booleanValue: true,
    nullableString: null,
    optionalNumber: undefined,
  },

  // Nested objects with various depths
  user: {
    id: 1001,
    profile: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      settings: {
        theme: 'dark',
        notifications: {
          email: true,
          push: false,
          sms: true,
        },
        privacy: {
          visibility: 'public',
          dataSharing: false,
        },
      },
      metadata: {
        lastLogin: Date.now() - 86400000, // 24 hours ago
        loginCount: 157,
        preferences: {
          language: 'en',
          timezone: 'UTC-8',
          dateFormat: 'MM/dd/yyyy',
        },
      },
    },
    permissions: ['read', 'write', 'admin'],
    roles: new Set(['user', 'moderator']),
  },

  // Arrays with different element types
  collections: {
    simpleArray: ['apple', 'banana', 'cherry'],
    numberArray: [1, 2, 3, 5, 8, 13],
    objectArray: [
      {
        id: 'task-001',
        title: 'Implement user authentication',
        completed: false,
        tags: ['backend', 'security', 'auth'],
        priority: 'high',
        metadata: {
          createdAt: Date.now() - 172800000, // 2 days ago
          updatedAt: Date.now() - 3600000, // 1 hour ago
        },
      },
      {
        id: 'task-002',
        title: 'Design dashboard UI',
        completed: true,
        tags: ['frontend', 'ui', 'design'],
        priority: 'medium',
        metadata: {
          createdAt: Date.now() - 259200000, // 3 days ago
        },
      },
      {
        id: 'task-003',
        title: 'Write unit tests',
        completed: false,
        tags: ['testing', 'quality'],
        priority: 'low',
        metadata: {
          createdAt: Date.now() - 86400000, // 1 day ago
        },
      },
    ],
    nestedArrays: [
      ['group1-item1', 'group1-item2'],
      ['group2-item1', 'group2-item2', 'group2-item3'],
      ['group3-item1'],
    ],
    mixedArray: [
      'string-item',
      42,
      {type: 'config', value: {enabled: true, timeout: 5000}},
      'another-string',
      100,
    ],
  },

  // Complex data structures
  dataStructures: {
    userMap: new Map([
      ['user-123', {name: 'Alice Smith', age: 28, active: true}],
      ['user-456', {name: 'Bob Johnson', age: 34, active: false}],
      ['user-789', {name: 'Carol Williams', age: 22, active: true}],
    ]),
    tagSet: new Set(['javascript', 'typescript', 'react', 'node', 'testing']),
    counters: {
      pageViews: 1250,
      uniqueVisitors: 340,
      conversions: 28,
      errorCount: 3,
    },
    configuration: {
      apiTimeout: {
        value: 5000,
        type: 'number',
        required: true,
        validation: {min: 1000, max: 30000},
      },
      debugMode: {
        value: false,
        type: 'boolean',
        required: false,
      },
      apiEndpoint: {
        value: 'https://api.example.com/v1',
        type: 'string',
        required: true,
        validation: {pattern: '^https?://'},
      },
    },
  },

  // UI state for dynamic updates
  ui: {
    loading: false,
    errors: [],
    modals: {
      'user-profile': {
        isOpen: false,
        data: {userId: 'user-123'},
        position: {x: 100, y: 150},
      },
      'confirm-delete': {
        isOpen: false,
      },
    },
    forms: {
      loginForm: {
        values: {email: '', password: ''},
        errors: {},
        touched: {},
        isValid: false,
      },
      profileForm: {
        values: {name: 'John Doe', email: 'john@example.com', bio: ''},
        errors: {bio: 'Bio is required'},
        touched: {name: true, email: true},
        isValid: false,
      },
    },
    navigation: {
      currentRoute: '/dashboard',
      history: ['/login', '/dashboard', '/profile'],
      breadcrumbs: [
        {label: 'Home', path: '/', isActive: false},
        {label: 'Dashboard', path: '/dashboard', isActive: true},
      ],
    },
  },

  // Application data with complex relationships
  application: {
    projects: [
      {
        id: 'proj-001',
        name: 'E-commerce Platform',
        status: 'active',
        team: {
          lead: 'user-123',
          members: ['user-456', 'user-789'],
          collaborators: new Set(['external-001', 'external-002']),
        },
        tasks: [
          {
            id: 'task-001',
            title: 'Implement payment gateway',
            assignee: 'user-456',
            status: 'in-progress',
            dependencies: ['task-002'],
            comments: [
              {
                id: 'comment-001',
                author: 'user-123',
                content: 'Please ensure PCI compliance',
                timestamp: Date.now() - 7200000, // 2 hours ago
                reactions: new Map([
                  ['👍', 2],
                  ['❤️', 1],
                ]),
              },
            ],
          },
          {
            id: 'task-002',
            title: 'Set up SSL certificates',
            status: 'done',
            dependencies: [],
            comments: [],
          },
        ],
        metadata: {
          createdAt: Date.now() - 2592000000, // 30 days ago
          updatedAt: Date.now() - 3600000, // 1 hour ago
          version: 2,
          settings: {
            autoAssign: true,
            notifyOnUpdate: false,
            allowExternalCollaborators: true,
          },
        },
      },
      {
        id: 'proj-002',
        name: 'Mobile App Redesign',
        status: 'completed',
        team: {
          lead: 'user-789',
          members: ['user-123'],
          collaborators: new Set(['designer-001']),
        },
        tasks: [
          {
            id: 'task-003',
            title: 'Create wireframes',
            status: 'done',
            dependencies: [],
            comments: [],
          },
        ],
        metadata: {
          createdAt: Date.now() - 5184000000, // 60 days ago
          updatedAt: Date.now() - 1209600000, // 14 days ago
          version: 1,
          settings: {
            autoAssign: false,
            notifyOnUpdate: true,
            allowExternalCollaborators: true,
          },
        },
      },
    ],
  },

  // Runtime dynamic data
  dynamic: {
    cache: new Map([
      [
        'user-data-123',
        {
          data: {name: 'Alice', lastSeen: Date.now() - 300000},
          timestamp: Date.now() - 300000,
          ttl: 3600000, // 1 hour
        },
      ],
      [
        'api-response-456',
        {
          data: {results: [1, 2, 3], total: 3},
          timestamp: Date.now() - 60000,
        },
      ],
    ]),
    subscriptions: new Set(['user-updates', 'system-notifications', 'task-changes']),
    eventHandlers: {
      'user-login': [
        {id: 'handler-001', handler: 'trackLogin', priority: 1},
        {id: 'handler-002', handler: 'updateLastSeen', priority: 2},
      ],
      'task-update': [{id: 'handler-003', handler: 'notifyAssignee', priority: 1}],
    },
    computed: {
      totalTasks: {
        value: 3,
        dependencies: ['application.projects'],
        lastComputed: Date.now() - 1800000, // 30 minutes ago
        isStale: false,
      },
      activeUsers: {
        value: 2,
        dependencies: ['dataStructures.userMap'],
        lastComputed: Date.now() - 3600000, // 1 hour ago
        isStale: true,
      },
    },
  },

  // Special cases for edge testing
  edgeCases: {
    emptyObject: {},
    emptyArray: [],
    emptyMap: new Map(),
    emptySet: new Set(),
    nullValue: null,
    undefinedValue: undefined,
    deepNesting: {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                value: 'deep-nested-string',
                data: [10, 20, 30, 40, 50],
              },
            },
          },
        },
      },
    },
  },
})
