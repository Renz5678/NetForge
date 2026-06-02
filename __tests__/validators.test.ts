import {
  isValidIpv4,
  isRfc1918PrivateIp,
  isValidCidr,
  sanitizeString,
  AclRuleSchema,
  DepartmentSchema,
  NetworkConfigSchema,
} from '../lib/validators'

describe('Validators Module Tests', () => {
  describe('Helper Functions', () => {
    test('isValidIpv4 validation', () => {
      expect(isValidIpv4('10.0.0.1')).toBe(true)
      expect(isValidIpv4('192.168.1.254')).toBe(true)
      expect(isValidIpv4('256.1.1.1')).toBe(false)
      expect(isValidIpv4('1.2.3.4.5')).toBe(false)
      expect(isValidIpv4('1.2.3')).toBe(false)
      expect(isValidIpv4('a.b.c.d')).toBe(false)
      expect(isValidIpv4('10.0.0.01')).toBe(false) // leading zeros check
    })

    test('isRfc1918PrivateIp validation', () => {
      expect(isRfc1918PrivateIp('10.0.0.1')).toBe(true)
      expect(isRfc1918PrivateIp('172.16.20.1')).toBe(true)
      expect(isRfc1918PrivateIp('172.31.255.255')).toBe(true)
      expect(isRfc1918PrivateIp('192.168.1.1')).toBe(true)
      
      // Public / other range IPs
      expect(isRfc1918PrivateIp('8.8.8.8')).toBe(false)
      expect(isRfc1918PrivateIp('172.15.255.255')).toBe(false)
      expect(isRfc1918PrivateIp('172.32.0.0')).toBe(false)
      expect(isRfc1918PrivateIp('192.167.255.255')).toBe(false)
      expect(isRfc1918PrivateIp('0.0.0.0')).toBe(false)
      expect(isRfc1918PrivateIp('255.255.255.255')).toBe(false)
    })

    test('isValidCidr validation', () => {
      expect(isValidCidr('10.0.0.0/24')).toBe(true)
      expect(isValidCidr('192.168.0.0/16')).toBe(true)
      expect(isValidCidr('172.16.0.0/12')).toBe(true)
      expect(isValidCidr('10.0.0.0/32')).toBe(true)
      expect(isValidCidr('10.0.0.0/0')).toBe(true)
      expect(isValidCidr('10.0.0.0/33')).toBe(false)
      expect(isValidCidr('10.0.0.0')).toBe(false)
      expect(isValidCidr('10.0.0.256/24')).toBe(false)
      expect(isValidCidr('any')).toBe(false)
    })

    test('sanitizeString validation', () => {
      expect(sanitizeString('<div>Hello & "World" / \'Test\'</div>')).toBe(
        '&lt;div&gt;Hello &amp; &quot;World&quot; &#x2F; &#x27;Test&#x27;&lt;&#x2F;div&gt;'
      )
    })
  })

  describe('AclRuleSchema', () => {
    test('valid acl rule', () => {
      const validRule = {
        id: 'acl-1',
        sequence: 10,
        action: 'permit',
        protocol: 'ip',
        srcCidr: '10.0.0.0/24',
        dstCidr: 'any',
        remark: 'Allow internal traffic',
      }
      const res = AclRuleSchema.safeParse(validRule)
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.remark).toBe('Allow internal traffic')
      }
    })

    test('invalid sequence number', () => {
      const invalidRule = {
        id: 'acl-1',
        sequence: 0,
        action: 'permit',
        protocol: 'ip',
        srcCidr: '10.0.0.0/24',
        dstCidr: 'any',
      }
      expect(AclRuleSchema.safeParse(invalidRule).success).toBe(false)
    })

    test('invalid CIDRs', () => {
      const invalidRule = {
        id: 'acl-1',
        sequence: 10,
        action: 'permit',
        protocol: 'ip',
        srcCidr: '10.0.0.0/35',
        dstCidr: 'any',
      }
      expect(AclRuleSchema.safeParse(invalidRule).success).toBe(false)
    })
  })

  describe('DepartmentSchema', () => {
    test('valid department with sanitization', () => {
      const validDept = {
        id: 'dept-1',
        name: 'Engineering <Eng>',
        deviceCount: 100,
        peers: [],
        type: 'department',
      }
      const res = DepartmentSchema.safeParse(validDept)
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.name).toBe('Engineering &lt;Eng&gt;')
      }
    })

    test('device count boundaries', () => {
      const base = { id: 'dept-1', name: 'Dept', peers: [], type: 'department' }
      
      expect(DepartmentSchema.safeParse({ ...base, deviceCount: 0 }).success).toBe(false)
      expect(DepartmentSchema.safeParse({ ...base, deviceCount: 1 }).success).toBe(true)
      expect(DepartmentSchema.safeParse({ ...base, deviceCount: 16000000 }).success).toBe(true)
      expect(DepartmentSchema.safeParse({ ...base, deviceCount: 16000001 }).success).toBe(false)
    })
  })

  describe('NetworkConfigSchema', () => {
    test('valid config', () => {
      const validConfig = {
        id: 'config-1',
        userId: 'user-1',
        name: 'My Network',
        departments: [
          { id: 'dept-1', name: 'Sales', deviceCount: 10, peers: ['dept-2'], type: 'department' },
          { id: 'dept-2', name: 'Marketing', deviceCount: 15, peers: [], type: 'department' },
        ],
        baseIp: '10.0.0.0',
        vlanStart: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      expect(NetworkConfigSchema.safeParse(validConfig).success).toBe(true)
    })

    test('invalid base IP address', () => {
      const invalidConfig = {
        id: 'config-1',
        userId: 'user-1',
        name: 'My Network',
        departments: [],
        baseIp: '8.8.8.8', // Public IP
        vlanStart: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const res = NetworkConfigSchema.safeParse(invalidConfig)
      expect(res.success).toBe(false)
    })

    test('peer ID referring to non-existent department', () => {
      const invalidConfig = {
        id: 'config-1',
        userId: 'user-1',
        name: 'My Network',
        departments: [
          { id: 'dept-1', name: 'Sales', deviceCount: 10, peers: ['non-existent'], type: 'department' },
        ],
        baseIp: '10.0.0.0',
        vlanStart: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const res = NetworkConfigSchema.safeParse(invalidConfig)
      expect(res.success).toBe(false)
    })
  })
})
