/**
 * AeroGrid Deterministic State Machine Engine
 * Enforces mathematically valid state lifecycles for Drones and Flight Delivery Missions.
 */

const DRONE_TRANSITIONS = {
  IDLE: ['DISPATCHED', 'MAINTENANCE', 'OFFLINE'],
  DISPATCHED: ['IN_FLIGHT', 'IDLE', 'ABORTED'],
  IN_FLIGHT: ['RETURNING', 'ABORTED'],
  RETURNING: ['IDLE', 'MAINTENANCE'],
  MAINTENANCE: ['IDLE', 'OFFLINE'],
  OFFLINE: ['IDLE', 'MAINTENANCE'],
};

const DELIVERY_TRANSITIONS = {
  IDLE: ['DISPATCHED', 'ABORTED'],
  PENDING: ['DISPATCHED', 'ABORTED'],
  DISPATCHED: ['IN_FLIGHT', 'ABORTED'],
  IN_FLIGHT: ['DELIVERED', 'ABORTED'],
  DELIVERED: [], // Terminal State
  ABORTED: [],   // Terminal State
};

class StateEngine {
  /**
   * Validates state transition for a delivery mission.
   * @param {string} currentState 
   * @param {string} targetState 
   * @returns {string} targetState if valid
   * @throws {Error} 409 Conflict if transition is illegal
   */
  static validateDeliveryTransition(currentState, targetState) {
    const allowed = DELIVERY_TRANSITIONS[currentState];

    if (!allowed) {
      const error = new Error(`Unknown delivery state: '${currentState}'.`);
      error.statusCode = 500;
      error.code = 'INVALID_STATE';
      throw error;
    }

    if (allowed.length === 0) {
      const error = new Error(`Cannot transition from terminal delivery state '${currentState}'.`);
      error.statusCode = 409;
      error.code = 'TERMINAL_STATE_LOCKED';
      throw error;
    }

    if (!allowed.includes(targetState)) {
      const error = new Error(
        `Illegal state transition: Cannot transition delivery from '${currentState}' to '${targetState}'. Permissible next states: [${allowed.join(', ')}].`
      );
      error.statusCode = 409;
      error.code = 'ILLEGAL_STATE_TRANSITION';
      throw error;
    }

    return targetState;
  }

  /**
   * Validates state transition for a drone.
   * @param {string} currentState 
   * @param {string} targetState 
   * @returns {string} targetState if valid
   * @throws {Error} 409 Conflict if transition is illegal
   */
  static validateDroneTransition(currentState, targetState) {
    const allowed = DRONE_TRANSITIONS[currentState];

    if (!allowed) {
      const error = new Error(`Unknown drone state: '${currentState}'.`);
      error.statusCode = 500;
      error.code = 'INVALID_STATE';
      throw error;
    }

    if (!allowed.includes(targetState)) {
      const error = new Error(
        `Illegal drone transition: Cannot transition drone from '${currentState}' to '${targetState}'. Permissible next states: [${allowed.join(', ')}].`
      );
      error.statusCode = 409;
      error.code = 'ILLEGAL_DRONE_TRANSITION';
      throw error;
    }

    return targetState;
  }
}

module.exports = {
  DRONE_TRANSITIONS,
  DELIVERY_TRANSITIONS,
  StateEngine,
};
