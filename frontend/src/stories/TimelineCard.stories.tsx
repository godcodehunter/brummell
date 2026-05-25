import { TreeCard, NodeTag, Category, Item, Node } from '../components/TreeCard';
import { constants } from '../globalStyles';

export default {
    title: 'TimelineCard',
    component: TreeCard,
    decorators: [
            (Story: any) => (
                <div
                    style={{
                        width: 340,
                        height: '100vh',
                        paddingTop: constants.gap,
                        paddingRight: constants.gap,
                        paddingBottom: constants.gap, 
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}
                >
                    <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
                    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
                    <Story />
                </div>
            ),
        ],
};

export const NoData = {
    args: {
        data: [],
    },
};

const cat = (id: string, label: string, children: Node[]): Category => ({
    tag: NodeTag.Category,
    id,
    label,
    children,
});

const item = (id: string, label: string): Item => ({
    tag: NodeTag.Item,
    id,
    label,
});

const data: Category[] = [
    cat("part-1", "Part 1: Survey", [
        cat("p1-c1", "Chapter 1: Foundations", [
            cat("p1-c1-s1", "1.1 Definitions", [
                cat("p1-c1-s1-ss1", "1.1.1 Core terms", [
                    cat("p1-c1-s1-ss1-sss1", "1.1.1.1 Primitives", [
                        cat("p1-c1-s1-ss1-sss1-ssss1", "1.1.1.1.1 Atoms", [
                            item("p1-c1-s1-ss1-sss1-ssss1-i1", "Quark"),
                            item("p1-c1-s1-ss1-sss1-ssss1-i2", "Lepton"),
                            item("p1-c1-s1-ss1-sss1-ssss1-i3", "Boson"),
                        ]),
                        cat("p1-c1-s1-ss1-sss1-ssss2", "1.1.1.1.2 Forces", [
                            item("p1-c1-s1-ss1-sss1-ssss2-i1", "Strong"),
                            item("p1-c1-s1-ss1-sss1-ssss2-i2", "Weak"),
                            item("p1-c1-s1-ss1-sss1-ssss2-i3", "Electromagnetic"),
                            item("p1-c1-s1-ss1-sss1-ssss2-i4", "Gravity"),
                        ]),
                        cat("p1-c1-s1-ss1-sss1-ssss3", "1.1.1.1.3 Fields", [
                            item("p1-c1-s1-ss1-sss1-ssss3-i1", "Higgs"),
                            item("p1-c1-s1-ss1-sss1-ssss3-i2", "Gauge"),
                        ]),
                        item("p1-c1-s1-ss1-sss1-i1", "Composition"),
                        item("p1-c1-s1-ss1-sss1-i2", "Decomposition"),
                    ]),
                    item("p1-c1-s1-ss1-i1", "Operators"),
                    item("p1-c1-s1-ss1-i2", "Relations"),
                ]),
                item("p1-c1-s1-i1", "Notation"),
                item("p1-c1-s1-i2", "Glossary"),
            ]),
            cat("p1-c1-s2", "1.2 Axioms", [
                item("p1-c1-s2-i1", "Reflexivity"),
                item("p1-c1-s2-i2", "Transitivity"),
            ]),
            item("p1-c1-i1", "Conventions"),
        ]),
        cat("p1-c2", "Chapter 2: Notation", [
            item("p1-c2-i1", "Symbols"),
            item("p1-c2-i2", "Indices"),
        ]),
        item("p1-i1", "Roadmap"),
    ]),
    cat("part-2", "Part 2: Method", [
        cat("p2-c1", "Chapter 1: Setup", [
            item("p2-c1-i1", "Environment"),
            item("p2-c1-i2", "Tooling"),
        ]),
        cat("p2-c2", "Chapter 2: Procedure", [
            cat("p2-c2-s1", "2.1 Pipeline", [
                item("p2-c2-s1-i1", "Inputs"),
                item("p2-c2-s1-i2", "Outputs"),
            ]),
            item("p2-c2-i1", "Validation"),
        ]),
    ]),
    cat("part-3", "Part 3: Discussion", [
        item("p3-i1", "Findings"),
        item("p3-i2", "Limitations"),
        item("p3-i3", "Open questions"),
    ]),
];

export const Filled = {
    args: {
        data,
    },
};
