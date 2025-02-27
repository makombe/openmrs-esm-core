import React, { useState, useEffect, useRef } from "react";
import isEqual from "lodash-es/isEqual";
import unset from "lodash-es/unset";
import cloneDeep from "lodash-es/cloneDeep";
import Reset16 from "@carbon/icons-react/es/reset/16";
import styles from "./editable-value.styles.css";
import { Button } from "carbon-components-react";
import {
  ConfigValue,
  Validator,
  Type,
  Config,
  temporaryConfigStore,
} from "@openmrs/esm-framework";
import { ValueEditor, CustomValueType } from "./value-editor";
import { implementerToolsStore, ImplementerToolsStore } from "../store";
import { DisplayValue } from "./display-value";

export interface EditableValueProps {
  path: Array<string>;
  element: ConfigValueDescriptor;
  customType?: CustomValueType;
}

export interface ConfigValueDescriptor {
  _value: ConfigValue;
  _source: string;
  _default?: ConfigValue;
  _description?: string;
  _elements?: Config | ConfigValueDescriptor;
  _validators?: Array<Validator>;
  _type?: Type;
}

export default function EditableValue({
  path,
  element,
  customType,
}: EditableValueProps) {
  const [valueString, setValueString] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeConfigRef = useRef<HTMLButtonElement>(null);

  const closeEditor = () => {
    setEditing(false);
    setError(null);
  };

  const focusOnConfigPathBeingEdited = () => {
    if (activeConfigRef && activeConfigRef.current) {
      setEditing(true);
      activeConfigRef.current.focus();
    }
  };

  useEffect(() => {
    const update = (state: ImplementerToolsStore) => {
      if (
        state.configPathBeingEdited &&
        isEqual(state.configPathBeingEdited, path)
      ) {
        focusOnConfigPathBeingEdited();
      }
    };
    update(implementerToolsStore.getState());
    return implementerToolsStore.subscribe(update);
  }, []);

  useEffect(() => {
    const state = implementerToolsStore.getState();
    if (editing && !isEqual(state.configPathBeingEdited, path)) {
      implementerToolsStore.setState({
        configPathBeingEdited: path,
        activeItemDescription: {
          path: path,
          source: element._source,
          description: element._description,
          value: valueString,
        },
      });
    }
    if (!editing && isEqual(state.configPathBeingEdited, path)) {
      implementerToolsStore.setState({ configPathBeingEdited: null });
    }
  }, [editing]);

  return (
    <>
      <div className={styles.line}>
        {editing ? (
          <>
            <ValueEditor
              element={element}
              customType={customType}
              path={path}
              handleClose={closeEditor}
              handleSave={(val) => {
                try {
                  const result = JSON.parse(val);
                  const tempConfigUpdate = set(
                    cloneDeep(temporaryConfigStore.getState()),
                    ["config", ...path],
                    result
                  );
                  temporaryConfigStore.setState(tempConfigUpdate);
                  setValueString(val);
                  closeEditor();
                } catch (e) {
                  console.warn(e);
                  setError("That's not formatted quite right. Try again.");
                }
              }}
            />
          </>
        ) : (
          <>
            <button
              className={`${styles.secretButton} ${
                element._source == "temporary config"
                  ? styles.overriddenValue
                  : ""
              }`}
              onClick={() => setEditing(true)}
              ref={activeConfigRef}
            >
              <DisplayValue value={element._value} />
            </button>
            {element._source == "temporary config" ? (
              <Button
                style={{ marginLeft: "1em" }}
                renderIcon={Reset16}
                size="sm"
                kind="tertiary"
                iconDescription="Reset to default"
                hasIconOnly
                onClick={() => {
                  temporaryConfigStore.setState(
                    unset(temporaryConfigStore.getState(), [
                      "config",
                      ...path,
                    ]) as any
                  );
                }}
              />
            ) : null}
          </>
        )}
        {error && <div className={styles.error}>{error}</div>}
      </div>
    </>
  );
}

// A substitute for the lodash.set function, which seems to be broken,
// at least within Jest.
function set<T>(obj: T, path: Array<string>, value: any): T {
  if (path.length > 1) {
    obj[path[0]] = set(obj[path[0]] ?? {}, path.slice(1), value);
  } else {
    obj[path[0]] = value;
  }
  return obj;
}
