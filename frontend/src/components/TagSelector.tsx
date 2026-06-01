import { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import chroma from "chroma-js";
import * as R from "ramda";
import { ChipHolder, Tag } from "./Chip";
import { Autocomplete } from "./Autocomplete";

const GET_TAGS = gql`
  query GetTags {
    getTag { label color tooltip }
  }
`;

interface TagSelectorProps {
    selected: Tag[];
    onChange: (next: Tag[]) => void;
    placeholder?: string;
}

// Tag picker shared between the public SearchCard and the admin article-meta
// form: chips for what's already chosen + an autocomplete that suggests
// unpicked tags pulled from `getTag`. Fully controlled — owner state lives
// in the parent so it can persist / submit the selection however it wants.
export const TagSelector = ({ selected, onChange, placeholder = "Add a topic..." }: TagSelectorProps) => {
    const { data } = useQuery(GET_TAGS);
    const allTags: Tag[] = useMemo(() => {
        const raw = data?.getTag ?? [];
        return raw.map((t: { label: string, color: string, tooltip: string }) => ({
            label: t.label,
            color: chroma(t.color),
            tooltip: t.tooltip,
        }));
    }, [data]);

    const available = useMemo(
        () => allTags.filter(t => !selected.some(s => s.label === t.label)),
        [allTags, selected],
    );

    return (
        <>
            <ChipHolder
                removable
                data={selected}
                style={{ marginBottom: selected.length !== 0 ? 6 : 0 }}
                onRemove={(i) => onChange(R.remove(i, 1, selected))}
            />
            <Autocomplete<Tag>
                variants={available}
                getLabel={(t) => t.label}
                onSelect={(t) => onChange([...selected, t])}
                placeholder={placeholder}
            />
        </>
    );
};
