import { REGISTRATION_STATES } from "@/lib/gst/states";

/** <option>s for a GST state picker: "29 · Karnataka". */
export function StateOptions({ placeholder = "Choose a state" }: { placeholder?: string }) {
  return (
    <>
      <option value="">{placeholder}</option>
      {REGISTRATION_STATES.map((state) => (
        <option key={state.code} value={state.code}>
          {state.code} · {state.name}
        </option>
      ))}
    </>
  );
}
