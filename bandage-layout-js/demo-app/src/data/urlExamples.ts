export interface URLExample {
  name: string
  description: string
  url: string
}

// Use relative URLs so the demo still works when hosted under a subdirectory
// such as /demos/bandagejs/ instead of the site root.
const BASE_URL = './test/'

export const urlExamples: URLExample[] = [
  {
    name: 'MT GFA-spec example',
    description: 'Mitochondrial genome from GFA spec',
    url: `${BASE_URL}MT.gfa`,
  },
  {
    name: 'Paths example',
    description: 'Toy pangenome with paths',
    url: `${BASE_URL}toy_pangenome.gfa`,
  },
  {
    name: 'Paths example 2',
    description: 'Another paths example',
    url: `${BASE_URL}example1.gfa`,
  },
  {
    name: 'Single-mode RC regression',
    description: 'Reverse-complement duplicate edges and directed paths',
    url: `${BASE_URL}single_mode_rc_regression.gfa`,
  },
  {
    name: 'HPRC Chr1',
    description: 'HPRC Chr1 (vg find output)',
    url: `${BASE_URL}chr1_sub.gfa`,
  },
  {
    name: 'Big1',
    description: 'Larger graph example',
    url: `${BASE_URL}big1.gfa`,
  },
  {
    name: 'Ir1',
    description: 'IR1 example graph',
    url: `${BASE_URL}ir1.gfa`,
  },
  {
    name: 'Unicycler example',
    description: 'Test contig placement assembly graph',
    url: `${BASE_URL}test_contig_placement_assembly_graph.gfa`,
  },
  {
    name: 'Simple circle',
    description: 'Simple circular graph',
    url: `${BASE_URL}circle.gfa`,
  },
  {
    name: 'GFA2.0 example',
    description: 'Example using GFA 2.0 format',
    url: `${BASE_URL}example1.gfa2`,
  },
]
