// Graph Database Visualizer
class GraphApp {
    constructor() {
        this.graphId = 'demo-graph';
        this.network = null;
        this.nodes = new vis.DataSet([]);
        this.edges = new vis.DataSet([]);
        this.selectedNode = null;
        this.selectedEdge = null;

        this.init();
    }

    init() {
        this.initializeGraph();
        this.attachEventListeners();
        this.loadGraph();
    }

    initializeGraph() {
        const container = document.getElementById('graph');
        const data = {
            nodes: this.nodes,
            edges: this.edges
        };

        const options = {
            nodes: {
                shape: 'dot',
                size: 20,
                font: {
                    size: 12,
                    color: '#1C1C1C',
                    face: 'Inter, sans-serif'
                },
                borderWidth: 2,
                borderWidthSelected: 3,
                color: {
                    border: '#5E6AD2',
                    background: '#FFFFFF',
                    highlight: {
                        border: '#5E6AD2',
                        background: '#E8EAFD'
                    },
                    hover: {
                        border: '#4F5BC4',
                        background: '#F9F9FB'
                    }
                },
                shadow: {
                    enabled: true,
                    color: 'rgba(0, 0, 0, 0.08)',
                    size: 8,
                    x: 0,
                    y: 2
                }
            },
            edges: {
                width: 1.5,
                color: {
                    color: '#D1D1D1',
                    highlight: '#5E6AD2',
                    hover: '#5E6AD2'
                },
                arrows: {
                    to: {
                        enabled: true,
                        scaleFactor: 0.6
                    }
                },
                font: {
                    size: 11,
                    color: '#6F6F6F',
                    strokeWidth: 0,
                    align: 'top',
                    face: 'Inter, sans-serif'
                },
                smooth: {
                    type: 'continuous',
                    roundness: 0.5
                }
            },
            physics: {
                enabled: true,
                stabilization: {
                    iterations: 100
                },
                barnesHut: {
                    gravitationalConstant: -2000,
                    springLength: 150,
                    springConstant: 0.04
                }
            },
            interaction: {
                hover: true,
                tooltipDelay: 100,
                zoomView: true,
                dragView: true
            },
            autoResize: true
        };

        this.network = new vis.Network(container, data, options);

        // Force initial fit
        setTimeout(() => {
            if (this.nodes.length > 0) {
                this.network.fit();
            }
        }, 100);

        // Handle selection events
        this.network.on('selectNode', (params) => {
            if (params.nodes.length > 0) {
                this.selectedNode = params.nodes[0];
                this.selectedEdge = null;
                this.updateGraphInfo(`Selected Node: ${this.selectedNode}`);
            }
        });

        this.network.on('selectEdge', (params) => {
            if (params.edges.length > 0) {
                this.selectedEdge = params.edges[0];
                this.selectedNode = null;
                const edge = this.edges.get(this.selectedEdge);
                this.updateGraphInfo(`Selected Edge: ${edge.from} → ${edge.to} (${edge.label})`);
            }
        });

        this.network.on('deselectNode', () => {
            this.selectedNode = null;
            this.updateGraphInfo('Click on nodes or edges to select them.');
        });

        this.network.on('deselectEdge', () => {
            this.selectedEdge = null;
            this.updateGraphInfo('Click on nodes or edges to select them.');
        });
    }

    attachEventListeners() {
        // Graph selection
        document.getElementById('loadGraph').addEventListener('click', () => this.loadGraph());
        document.getElementById('loadSampleData').addEventListener('click', () => this.loadSampleData());
        document.getElementById('clearGraph').addEventListener('click', () => this.clearLocalGraph());

        // Node operations
        document.getElementById('addNode').addEventListener('click', () => this.addNode());

        // Edge operations
        document.getElementById('addEdge').addEventListener('click', () => this.addEdge());

        // Graph operations
        document.getElementById('centerGraph').addEventListener('click', () => this.centerGraph());
        document.getElementById('deleteSelected').addEventListener('click', () => this.deleteSelected());
        document.getElementById('refreshStats').addEventListener('click', () => this.refreshStats());

        // Update graphId when input changes
        document.getElementById('graphId').addEventListener('change', (e) => {
            this.graphId = e.target.value || 'demo-graph';
        });
    }

    async loadGraph() {
        const graphIdInput = document.getElementById('graphId').value;
        if (graphIdInput) {
            this.graphId = graphIdInput;
        }

        this.showToast('Loading graph...', 'info');

        try {
            // Load all nodes
            const nodesResponse = await fetch(`/api/${this.graphId}/nodes`);
            const nodesData = await nodesResponse.json();

            // Load all edges
            const edgesResponse = await fetch(`/api/${this.graphId}/edges`);
            const edgesData = await edgesResponse.json();

            // Clear existing data
            this.nodes.clear();
            this.edges.clear();

            // Add nodes to visualization
            if (nodesData.nodes && nodesData.nodes.length > 0) {
                const visNodes = nodesData.nodes.map(node => ({
                    id: node.id,
                    label: node.id,
                    title: `Type: ${node.type}\nData: ${JSON.stringify(node.data, null, 2)}`,
                    group: node.type
                }));
                this.nodes.add(visNodes);
            }

            // Add edges to visualization
            if (edgesData.edges && edgesData.edges.length > 0) {
                const visEdges = edgesData.edges.map(edge => ({
                    id: `${edge.source}_${edge.relationship}_${edge.target}`,
                    from: edge.source,
                    to: edge.target,
                    label: edge.relationship,
                    title: edge.properties ? JSON.stringify(edge.properties, null, 2) : edge.relationship
                }));
                this.edges.add(visEdges);
            }

            this.refreshStats();

            // Fit the graph to show all nodes
            if (this.nodes.length > 0) {
                setTimeout(() => {
                    this.network.fit({
                        animation: {
                            duration: 500,
                            easingFunction: 'easeInOutQuad'
                        }
                    });
                }, 100);
            }

            this.showToast(`Loaded graph "${this.graphId}" successfully!`, 'success');
        } catch (error) {
            console.error('Error loading graph:', error);
            this.showToast('Error loading graph: ' + error.message, 'error');
        }
    }

    async loadSampleData() {
        this.showToast('Loading sample data...', 'info');

        try {
            // Create sample nodes
            const sampleNodes = [
                { id: 'alice', type: 'person', data: { name: 'Alice', role: 'Engineer' } },
                { id: 'bob', type: 'person', data: { name: 'Bob', role: 'Designer' } },
                { id: 'charlie', type: 'person', data: { name: 'Charlie', role: 'Manager' } },
                { id: 'project-x', type: 'project', data: { name: 'Project X', status: 'active' } }
            ];

            // Create sample edges
            const sampleEdges = [
                { source: 'alice', target: 'bob', relationship: 'collaborates_with', properties: { since: '2024' } },
                { source: 'bob', target: 'alice', relationship: 'collaborates_with', properties: { since: '2024' } },
                { source: 'charlie', target: 'alice', relationship: 'manages', properties: {} },
                { source: 'charlie', target: 'bob', relationship: 'manages', properties: {} },
                { source: 'alice', target: 'project-x', relationship: 'works_on', properties: { hours: 40 } },
                { source: 'bob', target: 'project-x', relationship: 'works_on', properties: { hours: 30 } }
            ];

            // Add nodes
            for (const node of sampleNodes) {
                await fetch(`/api/${this.graphId}/nodes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...node, userId: 'sample-data' })
                });
            }

            // Add edges
            for (const edge of sampleEdges) {
                await fetch(`/api/${this.graphId}/edges`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...edge, userId: 'sample-data' })
                });
            }

            // Reload the graph
            await this.loadGraph();
            this.showToast('Sample data loaded successfully!', 'success');
        } catch (error) {
            console.error('Error loading sample data:', error);
            this.showToast('Error loading sample data: ' + error.message, 'error');
        }
    }

    clearLocalGraph() {
        this.nodes.clear();
        this.edges.clear();
        this.showToast('Graph visualization cleared', 'info');
        this.refreshStats();
    }

    async addNode() {
        const nodeId = document.getElementById('nodeId').value;
        const nodeType = document.getElementById('nodeType').value;
        const nodeDataStr = document.getElementById('nodeData').value;

        if (!nodeId || !nodeType) {
            this.showToast('Please provide Node ID and Type', 'error');
            return;
        }

        let nodeData = {};
        try {
            nodeData = nodeDataStr ? JSON.parse(nodeDataStr) : {};
        } catch (e) {
            this.showToast('Invalid JSON in Node Data', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/${this.graphId}/nodes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: nodeId,
                    type: nodeType,
                    data: nodeData,
                    userId: 'web-ui'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to add node');
            }

            const result = await response.json();

            // Add to visualization
            this.nodes.add({
                id: result.node.id,
                label: result.node.id,
                title: `Type: ${result.node.type}\nData: ${JSON.stringify(result.node.data, null, 2)}`,
                group: result.node.type
            });

            // Fit to show the new node
            setTimeout(() => {
                this.network.fit({
                    animation: { duration: 300 }
                });
            }, 50);

            // Clear form
            document.getElementById('nodeId').value = '';
            document.getElementById('nodeType').value = '';
            document.getElementById('nodeData').value = '';

            this.showToast('Node added successfully!', 'success');
            this.refreshStats();
        } catch (error) {
            console.error('Error adding node:', error);
            this.showToast('Error adding node: ' + error.message, 'error');
        }
    }

    async addEdge() {
        const source = document.getElementById('edgeSource').value;
        const target = document.getElementById('edgeTarget').value;
        const relationship = document.getElementById('edgeRelationship').value;
        const propertiesStr = document.getElementById('edgeProperties').value;

        if (!source || !target || !relationship) {
            this.showToast('Please provide Source, Target, and Relationship', 'error');
            return;
        }

        let properties = {};
        try {
            properties = propertiesStr ? JSON.parse(propertiesStr) : {};
        } catch (e) {
            this.showToast('Invalid JSON in Edge Properties', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/${this.graphId}/edges`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source,
                    target,
                    relationship,
                    properties,
                    userId: 'web-ui'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to add edge');
            }

            const result = await response.json();

            // Add to visualization
            this.edges.add({
                id: `${result.edge.source}_${result.edge.relationship}_${result.edge.target}`,
                from: result.edge.source,
                to: result.edge.target,
                label: result.edge.relationship,
                title: result.edge.properties ? JSON.stringify(result.edge.properties, null, 2) : result.edge.relationship
            });

            // Fit to show the connections
            setTimeout(() => {
                this.network.fit({
                    animation: { duration: 300 }
                });
            }, 50);

            // Clear form
            document.getElementById('edgeSource').value = '';
            document.getElementById('edgeTarget').value = '';
            document.getElementById('edgeRelationship').value = '';
            document.getElementById('edgeProperties').value = '';

            this.showToast('Edge added successfully!', 'success');
            this.refreshStats();
        } catch (error) {
            console.error('Error adding edge:', error);
            this.showToast('Error adding edge: ' + error.message, 'error');
        }
    }

    async deleteSelected() {
        if (this.selectedNode) {
            await this.deleteNode(this.selectedNode);
        } else if (this.selectedEdge) {
            await this.deleteEdge(this.selectedEdge);
        } else {
            this.showToast('Please select a node or edge to delete', 'error');
        }
    }

    async deleteNode(nodeId) {
        try {
            const response = await fetch(`/api/${this.graphId}/nodes/${nodeId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete node');
            }

            // Remove from visualization
            this.nodes.remove(nodeId);

            // Remove connected edges
            const connectedEdges = this.network.getConnectedEdges(nodeId);
            this.edges.remove(connectedEdges);

            this.selectedNode = null;
            this.showToast('Node deleted successfully!', 'success');
            this.refreshStats();
        } catch (error) {
            console.error('Error deleting node:', error);
            this.showToast('Error deleting node: ' + error.message, 'error');
        }
    }

    async deleteEdge(edgeId) {
        try {
            const edge = this.edges.get(edgeId);
            const response = await fetch(`/api/${this.graphId}/edges/${edge.from}/${edge.label}/${edge.to}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete edge');
            }

            // Remove from visualization
            this.edges.remove(edgeId);

            this.selectedEdge = null;
            this.showToast('Edge deleted successfully!', 'success');
            this.refreshStats();
        } catch (error) {
            console.error('Error deleting edge:', error);
            this.showToast('Error deleting edge: ' + error.message, 'error');
        }
    }

    async refreshStats() {
        try {
            const response = await fetch(`/api/${this.graphId}/stats`);
            const stats = await response.json();

            document.getElementById('nodeCount').textContent = stats.totalNodes || 0;
            document.getElementById('edgeCount').textContent = stats.totalEdges || 0;
        } catch (error) {
            console.error('Error fetching stats:', error);
            document.getElementById('nodeCount').textContent = this.nodes.length;
            document.getElementById('edgeCount').textContent = this.edges.length;
        }
    }

    centerGraph() {
        this.network.fit({
            animation: {
                duration: 500,
                easingFunction: 'easeInOutQuad'
            }
        });
    }

    updateGraphInfo(message) {
        const info = document.getElementById('graphInfo');
        info.innerHTML = `<p>${message}</p>`;
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new GraphApp();
});
