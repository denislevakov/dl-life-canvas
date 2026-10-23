type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const cloudValuesEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => cloudValuesEqual(value, right[index]))
    );
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(right, key) &&
          cloudValuesEqual(left[key], right[key]),
      )
    );
  }
  return false;
};

const hasStringId = (value: unknown): value is JsonRecord & { id: string } =>
  isRecord(value) && typeof value.id === "string";

const canMergeById = (...arrays: unknown[][]) => {
  const items = arrays.flat();
  return items.length > 0 && items.every(hasStringId);
};

const mergeArraysById = (base: unknown[], local: unknown[], remote: unknown[]) => {
  const baseById = new Map(base.filter(hasStringId).map((item) => [item.id, item]));
  const localById = new Map(local.filter(hasStringId).map((item) => [item.id, item]));
  const remoteById = new Map(remote.filter(hasStringId).map((item) => [item.id, item]));
  const ids = [
    ...local.filter(hasStringId).map((item) => item.id),
    ...remote.filter(hasStringId).map((item) => item.id),
  ].filter((id, index, all) => all.indexOf(id) === index);

  return ids.flatMap((id) => {
    const baseItem = baseById.get(id);
    const localItem = localById.get(id);
    const remoteItem = remoteById.get(id);

    if (!localItem && !remoteItem) return [];
    if (!baseItem) {
      if (localItem && remoteItem) {
        return [mergeCloudValues({}, localItem, remoteItem)];
      }
      return [localItem ?? remoteItem];
    }

    if (!localItem) {
      return cloudValuesEqual(remoteItem, baseItem) ? [] : [remoteItem];
    }
    if (!remoteItem) {
      return cloudValuesEqual(localItem, baseItem) ? [] : [localItem];
    }

    return [mergeCloudValues(baseItem, localItem, remoteItem)];
  });
};

export function mergeCloudValues(base: unknown, local: unknown, remote: unknown): unknown {
  if (cloudValuesEqual(local, remote)) return local;
  if (cloudValuesEqual(local, base)) return remote;
  if (cloudValuesEqual(remote, base)) return local;

  if (base === undefined) {
    if ((local === "" || local === null) && remote !== "" && remote !== null) return remote;
    if ((remote === "" || remote === null) && local !== "" && local !== null) return local;
  }

  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    return canMergeById(base, local, remote) ? mergeArraysById(base, local, remote) : local;
  }

  if (isRecord(base) && isRecord(local) && isRecord(remote)) {
    const result: JsonRecord = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
    keys.forEach((key) => {
      result[key] = mergeCloudValues(base[key], local[key], remote[key]);
    });
    return result;
  }

  // When both devices changed the same scalar, keep the edit being made on
  // this device. The optimistic database check still prevents silent loss.
  return local;
}

export const mergeCloudState = <T>(base: T, local: T, remote: T): T =>
  mergeCloudValues(base, local, remote) as T;
