const { createHash, randomUUID } = require('node:crypto')
const AppError = require('../utils/AppError')

const MAX_STORED_PLANS = 100

function fingerprint(plan) {
  return createHash('sha256').update(JSON.stringify(plan)).digest('hex')
}

class PlanStore {
  constructor() {
    this.plans = new Map()
  }

  create(value) {
    const id = randomUUID()
    const record = {
      ...structuredClone(value),
      approvedFingerprint: null,
      createdAt: new Date().toISOString(),
      id,
      version: 1,
    }

    this.plans.set(id, record)

    if (this.plans.size > MAX_STORED_PLANS) {
      const oldestPlanId = this.plans.keys().next().value
      this.plans.delete(oldestPlanId)
    }

    return structuredClone(record)
  }

  get(planId, version) {
    const record = this.plans.get(planId)

    if (!record) {
      throw new AppError('Development plan not found', 404, 'PLAN_NOT_FOUND')
    }

    if (record.version !== version) {
      throw new AppError(
        'The development plan version has changed',
        409,
        'PLAN_VERSION_MISMATCH',
      )
    }

    return record
  }

  approve(planId, version) {
    const record = this.get(planId, version)
    record.approvedFingerprint = fingerprint(record.plan)
    record.approvedAt = new Date().toISOString()

    return {
      approved: true,
      approvedAt: record.approvedAt,
      planId: record.id,
      version: record.version,
    }
  }

  requireApproved(planId, version) {
    const record = this.get(planId, version)
    const currentFingerprint = fingerprint(record.plan)

    if (
      !record.approvedFingerprint ||
      record.approvedFingerprint !== currentFingerprint
    ) {
      throw new AppError(
        'The current development plan must be approved before generation',
        409,
        'PLAN_NOT_APPROVED',
      )
    }

    return structuredClone(record)
  }

  invalidate(planId, version) {
    const record = this.get(planId, version)
    record.approvedFingerprint = null
    delete record.approvedAt
  }

  clear() {
    this.plans.clear()
  }
}

const planStore = new PlanStore()

module.exports = { PlanStore, planStore }
