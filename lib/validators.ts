import { z } from 'zod'

// Helper to validate IPv4 address
export function isValidIpv4(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  return parts.every((part) => {
    const num = parseInt(part, 10)
    return !isNaN(num) && num >= 0 && num <= 255 && part === num.toString()
  })
}

// Helper to check if IP is in RFC 1918 private range
export function isRfc1918PrivateIp(ip: string): boolean {
  if (!isValidIpv4(ip)) return false
  const parts = ip.split('.').map((p) => parseInt(p, 10))
  const [o1, o2] = parts
  if (o1 === 10) return true
  if (o1 === 172 && o2 >= 16 && o2 <= 31) return true
  if (o1 === 192 && o2 === 168) return true
  return false
}

// Helper to validate CIDR notation
export function isValidCidr(cidr: string): boolean {
  const parts = cidr.split('/')
  if (parts.length !== 2) return false
  const [ip, prefixStr] = parts
  if (!isValidIpv4(ip)) return false
  const prefix = parseInt(prefixStr, 10)
  return !isNaN(prefix) && prefix >= 0 && prefix <= 32 && prefixStr === prefix.toString()
}

// Helper to sanitize strings to prevent XSS
export function sanitizeString(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

export const AclRuleSchema = z
  .object({
    id: z.string(),
    sequence: z.number().int().min(1, 'Sequence must be at least 1'),
    action: z.enum(['permit', 'deny']),
    protocol: z.enum(['ip', 'tcp', 'udp', 'icmp']),
    srcCidr: z.string().refine((val) => val === 'any' || isValidCidr(val), {
      message: 'Source must be "any" or a valid CIDR (e.g. 10.0.0.0/24)',
    }),
    dstCidr: z.string().refine((val) => val === 'any' || isValidCidr(val), {
      message: 'Destination must be "any" or a valid CIDR (e.g. 10.0.0.0/24)',
    }),
    dstPort: z.number().int().min(0).max(65535).optional(),
    remark: z.string().optional(),
  })
  .transform((val) => ({
    ...val,
    remark: val.remark ? sanitizeString(val.remark) : undefined,
  }))

export const DepartmentSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
    deviceCount: z
      .number()
      .int()
      .min(1, 'Device count must be at least 1')
      .max(16000000, 'Device count cannot exceed 16,000,000'),
    peers: z.array(z.string()),
    vlanId: z.number().int().min(1, 'VLAN ID must be between 1 and 4094').max(4094).optional(),
    cidrPrefix: z.number().int().min(0).max(32).optional(),
    usableHosts: z.number().int().min(0).optional(),
    type: z.enum(['department', 'router', 'switch', 'firewall', 'wan']).optional(),
    subnet: z
      .string()
      .refine((val) => !val || isValidCidr(val), {
        message: 'Subnet must be a valid CIDR notation',
      })
      .optional(),
    aclRules: z.array(AclRuleSchema).optional(),
  })
  .transform((val) => ({
    ...val,
    name: sanitizeString(val.name),
  }))

export const NetworkConfigSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    name: z.string().min(1, 'Config name is required').max(100, 'Config name is too long'),
    departments: z.array(DepartmentSchema),
    baseIp: z.string().refine(isRfc1918PrivateIp, {
      message: 'Base IP must be a valid RFC 1918 private IP address (e.g. 10.0.0.0)',
    }),
    vlanStart: z
      .number()
      .int()
      .min(1, 'VLAN start must be between 1 and 4094')
      .max(4094, 'VLAN start must be between 1 and 4094'),
    createdAt: z.string(),
    updatedAt: z.string(),
    isValid: z.boolean().optional(),
  })
  .superRefine((config, ctx) => {
    const deptIds = new Set(config.departments.map((d) => d.id))
    config.departments.forEach((dept, index) => {
      dept.peers.forEach((peerId, peerIndex) => {
        if (!deptIds.has(peerId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Peer ID "${peerId}" references a non-existent department`,
            path: ['departments', index, 'peers', peerIndex],
          })
        }
      })
    })
  })
  .transform((val) => ({
    ...val,
    name: sanitizeString(val.name),
  }))
