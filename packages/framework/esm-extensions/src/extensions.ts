import { getExtensionSlotsConfigStore } from "@openmrs/esm-config";
import {
  ExtensionRegistration,
  ExtensionSlotInfo,
  ExtensionSlotInstance,
  ExtensionStore,
  extensionStore,
  updateExtensionStore,
} from "./store";

function createNewExtensionSlotInstance(): ExtensionSlotInstance {
  return {
    addedIds: [],
    idOrder: [],
    removedIds: [],
  };
}

function createNewExtensionSlotInfo(
  extensionSlotName: string
): ExtensionSlotInfo {
  return {
    name: extensionSlotName,
    attachedIds: [],
    instances: {},
  };
}

export function getExtensionNameFromId(extensionId: string) {
  const [extensionName] = extensionId.split("#");
  return extensionName;
}

export function getExtensionRegistrationFrom(
  state: ExtensionStore,
  extensionId: string
): ExtensionRegistration | undefined {
  const name = getExtensionNameFromId(extensionId);
  return state.extensions[name];
}

export function getExtensionRegistration(
  extensionId: string
): ExtensionRegistration | undefined {
  const state = extensionStore.getState();
  return getExtensionRegistrationFrom(state, extensionId);
}

export interface ExtensionDetails {
  moduleName: string;
  load: () => Promise<any>;
  meta: Record<string, any>;
  online?: boolean | object;
  offline?: boolean | object;
  order?: number;
}

export const registerExtension: (
  name: string,
  details: ExtensionDetails
) => void = extensionStore.action(
  (state, name: string, details: ExtensionDetails) => {
    state.extensions[name] = {
      ...details,
      name,
      instances: {},
    };
  }
);

export function attach(extensionSlotName: string, extensionId: string) {
  updateExtensionStore((state) => {
    const existingSlot = state.slots[extensionSlotName];

    if (!existingSlot) {
      return {
        ...state,
        slots: {
          ...state.slots,
          [extensionSlotName]: {
            ...createNewExtensionSlotInfo(extensionSlotName),
            attachedIds: [extensionId],
          },
        },
      };
    } else {
      return {
        ...state,
        slots: {
          ...state.slots,
          [extensionSlotName]: {
            ...existingSlot,
            attachedIds: [...existingSlot.attachedIds, extensionId],
          },
        },
      };
    }
  });
}

export function detach(extensionSlotName: string, extensionId: string) {
  updateExtensionStore((state) => {
    const existingSlot = state.slots[extensionSlotName];

    if (existingSlot && existingSlot.attachedIds.includes(extensionId)) {
      return {
        ...state,
        slots: {
          ...state.slots,
          [extensionSlotName]: {
            ...existingSlot,
            attachedIds: existingSlot.attachedIds.filter(
              (id) => id !== extensionId
            ),
          },
        },
      };
    } else {
      return state;
    }
  });
}

export function detachAll(extensionSlotName: string) {
  updateExtensionStore((state) => {
    const existingSlot = state.slots[extensionSlotName];

    if (existingSlot) {
      return {
        ...state,
        slots: {
          ...state.slots,
          [extensionSlotName]: {
            ...existingSlot,
            attachedIds: [],
          },
        },
      };
    } else {
      return state;
    }
  });
}

function getOrder(
  configuredOrder: number,
  extension: Partial<ExtensionRegistration> = {}
) {
  if (configuredOrder === -1) {
    const { order = -1 } = extension;
    return order;
  }

  return configuredOrder;
}

export function getAssignedIds(
  instance: ExtensionSlotInstance,
  attachedIds: Array<string>
) {
  const { addedIds, removedIds, idOrder } = instance;
  const { extensions } = extensionStore.getState();

  return [...attachedIds, ...addedIds]
    .filter((m) => !removedIds.includes(m))
    .sort((a, b) => {
      const ai = getOrder(idOrder.indexOf(a), extensions[a]);
      const bi = getOrder(idOrder.indexOf(b), extensions[b]);

      if (bi === -1) {
        return -1;
      } else if (ai === -1) {
        return 1;
      } else {
        return ai - bi;
      }
    });
}

function getUpdatedExtensionSlotInfoForRegistration(
  existingSlot: ExtensionSlotInfo,
  slotName: string,
  moduleName: string
) {
  if (!existingSlot) {
    return getUpdatedExtensionSlotInfo(slotName, moduleName, {
      ...createNewExtensionSlotInfo(slotName),
      instances: {
        [moduleName]: createNewExtensionSlotInstance(),
      },
    });
  } else if (moduleName in existingSlot.instances) {
    return getUpdatedExtensionSlotInfo(slotName, moduleName, existingSlot);
  } else {
    return getUpdatedExtensionSlotInfo(slotName, moduleName, {
      ...existingSlot,
      instances: {
        ...existingSlot.instances,
        [moduleName]: createNewExtensionSlotInstance(),
      },
    });
  }
}

function getUpdatedExtensionSlotInfoForUnregistration(
  existingSlot: ExtensionSlotInfo,
  extensionSlotName: string,
  moduleName: string
) {
  const { [moduleName]: existing, ...instances } = existingSlot.instances;

  return getUpdatedExtensionSlotInfo(extensionSlotName, moduleName, {
    ...existingSlot,
    instances,
  });
}

/**
 * @param moduleName The name of the module that contains the extension slot
 * @param slotName The extension slot name that is actually used
 */
export function registerExtensionSlot(moduleName: string, slotName: string) {
  updateExtensionStore((state) => {
    const existingSlot = state.slots[slotName];
    const updatedSlot = getUpdatedExtensionSlotInfoForRegistration(
      existingSlot,
      slotName,
      moduleName
    );

    if (existingSlot !== updatedSlot) {
      return {
        ...state,
        slots: {
          ...state.slots,
          [slotName]: updatedSlot,
        },
      };
    }

    return state;
  });
}

export function unregisterExtensionSlot(moduleName: string, slotName: string) {
  updateExtensionStore((state) => {
    const existingSlot = state.slots[slotName];

    if (existingSlot && moduleName in existingSlot.instances) {
      const updatedSlot = getUpdatedExtensionSlotInfoForUnregistration(
        existingSlot,
        slotName,
        moduleName
      );

      return {
        ...state,
        slots: {
          ...state.slots,
          [slotName]: updatedSlot,
        },
      };
    }

    return state;
  });
}

export function getExtensionSlotsForModule(moduleName: string) {
  const state = extensionStore.getState();
  return Object.keys(state.slots).filter(
    (name) => moduleName in state.slots[name].instances
  );
}

/**
 * @internal
 * Just for testing.
 */
export const reset: () => void = extensionStore.action(() => {
  return {
    slots: {},
    extensions: {},
  };
});

/**
 * Returns information describing all extensions which can be rendered into an extension slot with
 * the specified name.
 * The returned information describe the extension itself, as well as the extension slot name(s)
 * with which it has been attached.
 * @param slotName The extension slot name for which matching extension info should be returned.
 * @param moduleName The module name. Used for applying extension-specific config values to the result.
 * @param extensionSlot The extension slot information object.
 */
export function getUpdatedExtensionSlotInfo(
  slotName: string,
  moduleName: string,
  extensionSlot: ExtensionSlotInfo
): ExtensionSlotInfo {
  let instance = extensionSlot.instances[moduleName];

  if (instance) {
    const originalInstance = instance;
    const config =
      getExtensionSlotsConfigStore(moduleName).getState().extensionSlotConfigs[
        slotName
      ] ?? {};

    if (Array.isArray(config.add)) {
      config.add.forEach((extensionId) => {
        if (!instance.addedIds.includes(extensionId)) {
          instance = {
            ...instance,
            addedIds: [...instance.addedIds, extensionId],
          };
        }
      });
    }

    if (Array.isArray(config.remove)) {
      config.remove.forEach((extensionId) => {
        if (!instance.removedIds.includes(extensionId)) {
          instance = {
            ...instance,
            removedIds: [...instance.removedIds, extensionId],
          };
        }
      });
    }

    if (Array.isArray(config.order)) {
      const testOrder = config.order.join(",");
      const fullOrder = instance.idOrder.join(",");

      if (!fullOrder.endsWith(testOrder)) {
        config.order.forEach((extensionId) => {
          instance = {
            ...instance,
            idOrder: [
              ...instance.idOrder.filter((m) => m !== extensionId),
              extensionId,
            ],
          };
        });
      }
    }

    if (instance !== originalInstance) {
      return {
        ...extensionSlot,
        instances: {
          ...extensionSlot.instances,
          [moduleName]: instance,
        },
      };
    }
  }

  return extensionSlot;
}
