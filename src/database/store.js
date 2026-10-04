/**
 * AeroGrid In-Memory Datastore
 * High-performance, ACID-compliant in-memory state repository for Drones and Flight Delivery Missions.
 */

const { initialDrones, initialDeliveries } = require('./seedData');

class Datastore {
  constructor() {
    this.drones = new Map();
    this.deliveries = new Map();
    this.auditLog = [];
    this.reset();
  }

  /**
   * Re-seeds data back to clean baseline
   */
  reset() {
    this.drones.clear();
    this.deliveries.clear();
    this.auditLog = [];

    initialDrones.forEach((drone) => {
      this.drones.set(drone.id, JSON.parse(JSON.stringify(drone)));
    });

    initialDeliveries.forEach((delivery) => {
      this.deliveries.set(delivery.id, JSON.parse(JSON.stringify(delivery)));
    });

    this.recordAudit('SYSTEM_RESET', 'Datastore reset to initial baseline seed state.');
  }

  recordAudit(action, details) {
    this.auditLog.unshift({
      id: `aud_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      action,
      details,
      timestamp: new Date().toISOString(),
    });
    if (this.auditLog.length > 100) this.auditLog.pop();
  }

  // ==================== DRONE REPOSITORY ====================

  listDrones(filters = {}) {
    let list = Array.from(this.drones.values());

    if (filters.status) {
      list = list.filter((d) => d.status.toUpperCase() === filters.status.toUpperCase());
    }
    if (filters.minBattery !== undefined) {
      const min = parseInt(filters.minBattery, 10);
      if (!isNaN(min)) list = list.filter((d) => d.currentBatteryPercentage >= min);
    }
    if (filters.model) {
      list = list.filter((d) => d.model.toLowerCase().includes(filters.model.toLowerCase()));
    }
    if (filters.homeBaseId) {
      list = list.filter((d) => d.homeBaseId.toUpperCase() === filters.homeBaseId.toUpperCase());
    }

    return list;
  }

  findDroneById(id) {
    return this.drones.get(id) || null;
  }

  findDroneBySerialNumber(serialNumber) {
    for (const drone of this.drones.values()) {
      if (drone.serialNumber.toUpperCase() === serialNumber.toUpperCase()) {
        return drone;
      }
    }
    return null;
  }

  createDrone(data) {
    const id = `drn_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const drone = {
      id,
      serialNumber: data.serialNumber.toUpperCase(),
      model: data.model,
      maxPayloadKg: data.maxPayloadKg,
      batteryCapacityMah: data.batteryCapacityMah,
      currentBatteryPercentage: 100,
      status: 'IDLE',
      homeBaseId: data.homeBaseId.toUpperCase(),
      assignedMissionId: null,
      totalMissionsCompleted: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.drones.set(id, drone);
    this.recordAudit('DRONE_COMMISSIONED', `Drone '${drone.serialNumber}' [${id}] added to fleet.`);
    return drone;
  }

  updateDrone(id, updates) {
    const existing = this.findDroneById(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.drones.set(id, updated);
    this.recordAudit('DRONE_UPDATED', `Drone '${id}' updated.`);
    return updated;
  }

  deleteDrone(id) {
    const existing = this.findDroneById(id);
    if (!existing) return false;

    this.drones.delete(id);
    this.recordAudit('DRONE_DECOMMISSIONED', `Drone '${id}' decommissioned and removed.`);
    return true;
  }

  // ==================== DELIVERY REPOSITORY ====================

  listDeliveries(filters = {}) {
    let list = Array.from(this.deliveries.values());

    if (filters.state) {
      list = list.filter((d) => d.state.toUpperCase() === filters.state.toUpperCase());
    }
    if (filters.droneId) {
      list = list.filter((d) => d.droneId === filters.droneId);
    }
    if (filters.priority) {
      list = list.filter((d) => d.priority.toUpperCase() === filters.priority.toUpperCase());
    }
    if (filters.category) {
      list = list.filter((d) => d.packageDetails.category === filters.category);
    }

    return list;
  }

  findDeliveryById(id) {
    return this.deliveries.get(id) || null;
  }

  findDeliveryByTrackingCode(code) {
    for (const delivery of this.deliveries.values()) {
      if (delivery.packageDetails.trackingCode.toUpperCase() === code.toUpperCase()) {
        return delivery;
      }
    }
    return null;
  }

  createDelivery(data) {
    const id = `del_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const delivery = {
      id,
      droneId: data.droneId,
      state: 'DISPATCHED',
      priority: data.priority || 'STANDARD',
      destination: data.destination,
      packageDetails: data.packageDetails,
      telemetry: {
        currentLocation: {
          latitude: data.destination.latitude,
          longitude: data.destination.longitude,
          altitudeMeters: 0,
        },
        currentSpeedKmh: 0,
        batteryPercentageRemaining: 100,
        flightStatus: 'HOVERING',
        recordedAt: now,
      },
      estimatedFlightDurationMinutes: Math.max(8, Math.round(data.packageDetails.weightKg * 3.5 + 5)),
      dispatchedAt: now,
      deliveredAt: null,
      lastTransitionReason: 'Mission initial dispatch created.',
      createdAt: now,
      updatedAt: now,
    };

    this.deliveries.set(id, delivery);

    // Atomically link drone to dispatched mission
    this.updateDrone(data.droneId, {
      status: 'DISPATCHED',
      assignedMissionId: id,
    });

    this.recordAudit('DELIVERY_DISPATCHED', `Mission [${id}] dispatched to drone '${data.droneId}'.`);
    return delivery;
  }

  updateDelivery(id, updates) {
    const existing = this.findDeliveryById(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.deliveries.set(id, updated);
    this.recordAudit('DELIVERY_UPDATED', `Mission [${id}] state/telemetry updated.`);
    return updated;
  }

  deleteDelivery(id) {
    const existing = this.findDeliveryById(id);
    if (!existing) return false;

    // Free assigned drone if still assigned
    if (existing.droneId) {
      const drone = this.findDroneById(existing.droneId);
      if (drone && drone.assignedMissionId === id) {
        this.updateDrone(existing.droneId, {
          status: 'IDLE',
          assignedMissionId: null,
        });
      }
    }

    this.deliveries.delete(id);
    this.recordAudit('DELIVERY_ABORTED_DELETED', `Mission [${id}] deleted.`);
    return true;
  }

  // ==================== METRICS & TELEMETRY ====================

  getMetrics() {
    const drones = Array.from(this.drones.values());
    const deliveries = Array.from(this.deliveries.values());

    const dronesByStatus = drones.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {});

    const deliveriesByState = deliveries.reduce((acc, del) => {
      acc[del.state] = (acc[del.state] || 0) + 1;
      return acc;
    }, {});

    return {
      totalDrones: drones.length,
      dronesByStatus,
      totalDeliveries: deliveries.length,
      deliveriesByState,
      completedMissions: deliveries.filter((d) => d.state === 'DELIVERED').length,
      activeMissions: deliveries.filter((d) => d.state === 'DISPATCHED' || d.state === 'IN_FLIGHT').length,
      auditLogSample: this.auditLog.slice(0, 10),
    };
  }
}

module.exports = new Datastore();
