document.addEventListener('DOMContentLoaded', () => {
    const modulesPalette = document.getElementById('modules-palette');
    const flowCanvas = document.getElementById('flow-canvas');
    const flowCanvasInner = document.getElementById('flow-canvas-inner'); // 新增的内部容器
    const moduleDetails = document.getElementById('module-details');
    const saveFlowButton = document.getElementById('save-flow');
    const loadFlowInput = document.getElementById('load-flow-input');
    const loadFlowButton = document.getElementById('load-flow-btn');
    const zoomInButton = document.getElementById('zoom-in');
    const zoomOutButton = document.getElementById('zoom-out');

    let availableModules = []; // 从 modules.json 加载的模块
    let flowNodes = []; // 当前画布上的模块实例
    let selectedNode = null; // 当前选中的模块
    let nextModuleId = 1; // 用于生成 moduleUIName 的唯一 ID

    let currentZoom = 1.0; // 当前缩放级别
    const zoomStep = 0.1;
    const minZoom = 0.5;
    const maxZoom = 2.0;

    let isDraggingNode = false;
    let dragOffsetX, dragOffsetY;

    let isDrawingConnection = false;
    let startNodeId = null;
    let startHandleType = null; // '0' or 'others'
    let currentLine = null;

    // 连接信息
    // 结构: [{ startNodeId: string, startHandleType: '0' | 'others', endNodeId: string }]
    let connections = [];

    let availableModuleParameters = []; // 从 modules_parameter.json 加载的模块参数定义

    // 动态获取应用的基路径，以适应 GitHub Pages 的子目录部署
    function getBasePath() {
        const path = window.location.pathname;
        const base = path.substring(0, path.lastIndexOf('/'));
        return base === '' ? '' : base;
    }

    const basePath = getBasePath();

    // 为了在 flowCanvas 内部绘制 SVG 线条，我们需要一个 SVG 元素
    // 这里我们将 SVG 元素直接作为 flowCanvasInner 的第一个子元素，这样可以确保它在所有节点之下
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.zIndex = '0'; // 确保线条在节点下方
    flowCanvasInner.appendChild(svg); // 添加 SVG 容器到 flowCanvasInner

    // 修改 drawConnectionLine 和 renderConnections 以使用这个 SVG 容器
    function getSvgCoordinates(clientX, clientY) {
        const flowCanvasRect = flowCanvas.getBoundingClientRect(); // 获取 flowCanvas 的位置
        // 计算鼠标事件相对于 flowCanvasInner 的位置，同时考虑滚动和缩放
        const x = (clientX - flowCanvasRect.left + flowCanvas.scrollLeft) / currentZoom;
        const y = (clientY - flowCanvasRect.top + flowCanvas.scrollTop) / currentZoom;
        return { x, y };
    }

    // --- 绘制连接线 ---
    function drawConnectionLine(lineElement, startNodeId, startHandleType, endPoint) {
        const startNodeDiv = document.getElementById(startNodeId);
        if (!startNodeDiv) return;

        const startHandle = startNodeDiv.querySelector(`.handle.output-${startHandleType}`);
        if (!startHandle) return;

        const startRect = startHandle.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();

        const x1 = (startRect.left + startRect.width / 2 - svgRect.left) / currentZoom;
        const y1 = (startRect.top + startRect.height / 2 - svgRect.top) / currentZoom;

        const x2 = endPoint.x;
        const y2 = endPoint.y;

        const path = `M${x1} ${y1} L${x2} ${y2}`;
        lineElement.setAttribute('d', path);
    }

    // --- 渲染所有连接线 ---
    function renderConnections() {
        // 清除旧的连接线和删除按钮
        svg.querySelectorAll('.connection-group').forEach(group => group.remove());

        connections.forEach((conn, index) => {
            const startNodeDiv = document.getElementById(conn.startNodeId);
            const targetNodeDiv = document.getElementById(conn.endNodeId);

            if (startNodeDiv && targetNodeDiv) {
                const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                group.classList.add('connection-group');
                group.dataset.connectionIndex = index; // 存储连接的索引
                svg.appendChild(group);

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                line.classList.add('connection-line');
                line.setAttribute('stroke', 'black'); // 显式设置颜色
                line.setAttribute('stroke-width', '2'); // 显式设置宽度
                line.setAttribute('fill', 'none'); // 确保没有填充
                group.appendChild(line);

                const startHandle = startNodeDiv.querySelector(`.handle.output-${conn.startHandleType}`);
                const targetHandle = targetNodeDiv.querySelector(`.handle.input-anchor`);

                if (!startHandle || !targetHandle) return; // 如果找不到句柄，则跳过

                const startRect = startHandle.getBoundingClientRect();
                const targetRect = targetHandle.getBoundingClientRect();
                const svgRect = svg.getBoundingClientRect();

                const x1 = (startRect.left + startRect.width / 2 - svgRect.left) / currentZoom;
                const y1 = (startRect.top + startRect.height / 2 - svgRect.top) / currentZoom;
                const x2 = (targetRect.left + targetRect.width / 2 - svgRect.left) / currentZoom;
                const y2 = (targetRect.top + targetRect.height / 2 - svgRect.top) / currentZoom;

                const path = `M${x1} ${y1} L${x2} ${y2}`;
                line.setAttribute('d', path);

                // 添加删除按钮 (圆形和文本)
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                const deleteButtonCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                deleteButtonCircle.classList.add('connection-delete-button');
                deleteButtonCircle.setAttribute('cx', midX);
                deleteButtonCircle.setAttribute('cy', midY);
                deleteButtonCircle.setAttribute('r', 8); // 半径
                group.appendChild(deleteButtonCircle);

                const deleteButtonText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                deleteButtonText.classList.add('connection-delete-text');
                deleteButtonText.setAttribute('x', midX);
                deleteButtonText.setAttribute('y', midY);
                deleteButtonText.textContent = 'x';
                group.appendChild(deleteButtonText);

                // 为删除按钮添加点击事件
                group.addEventListener('click', (e) => {
                    e.stopPropagation(); // 阻止事件冒泡到画布
                    removeConnection(index);
                });
            }
        });
    }

    // --- 更新单个节点的连接线 ---
    function updateConnections(nodeId) {
        // 遍历所有连接，更新与 nodeId 相关的所有连接线
        connections.forEach((conn, index) => {
            if (conn.startNodeId === nodeId || conn.endNodeId === nodeId) {
                // 找到对应的 SVG group 元素
                const group = svg.querySelector(`.connection-group[data-connection-index="${index}"]`);
                if (group) {
                    const line = group.querySelector('.connection-line');
                    const deleteButtonCircle = group.querySelector('.connection-delete-button');
                    const deleteButtonText = group.querySelector('.connection-delete-text');

                    const startNodeDiv = document.getElementById(conn.startNodeId);
                    const targetNodeDiv = document.getElementById(conn.endNodeId);

                    if (startNodeDiv && targetNodeDiv && line && deleteButtonCircle && deleteButtonText) {
                        const startHandle = startNodeDiv.querySelector(`.handle.output-${conn.startHandleType}`);
                        const targetHandle = targetNodeDiv.querySelector(`.handle.input-anchor`);

                        if (!startHandle || !targetHandle) return; // 如果找不到句柄，则跳过

                        const startRect = startHandle.getBoundingClientRect();
                        const targetRect = targetHandle.getBoundingClientRect();
                        const svgRect = svg.getBoundingClientRect();

                        const x1 = (startRect.left + startRect.width / 2 - svgRect.left) / currentZoom;
                        const y1 = (startRect.top + startRect.height / 2 - svgRect.top) / currentZoom;
                        const x2 = (targetRect.left + targetRect.width / 2 - svgRect.left) / currentZoom;
                        const y2 = (targetRect.top + targetRect.height / 2 - svgRect.top) / currentZoom;

                        const path = `M${x1} ${y1} L${x2} ${y2}`;
                        line.setAttribute('d', path);

                        // 更新删除按钮的位置
                        const midX = (x1 + x2) / 2;
                        const midY = (y1 + y2) / 2;
                        deleteButtonCircle.setAttribute('cx', midX);
                        deleteButtonCircle.setAttribute('cy', midY);
                        deleteButtonText.setAttribute('x', midX);
                        deleteButtonText.setAttribute('y', midY);
                    }
                }
            }
        });
    }

    // --- 开始绘制连接线 ---
    function startDrawingConnection(handleElement) {
        isDrawingConnection = true;
        startNodeId = handleElement.dataset.nodeId;
        startHandleType = handleElement.dataset.handleType;

        currentLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        currentLine.classList.add('connection-line', 'dragging');
        currentLine.setAttribute('stroke', 'blue'); // 临时虚线颜色
        currentLine.setAttribute('stroke-dasharray', '5 5'); // 虚线
        currentLine.setAttribute('stroke-width', '2');
        currentLine.setAttribute('fill', 'none');
        svg.appendChild(currentLine); // 添加到 SVG 容器

        // 初始位置，让线从句柄中心开始
        const handleRect = handleElement.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        const startX = (handleRect.left + handleRect.width / 2 - svgRect.left) / currentZoom;
        const startY = (handleRect.top + handleRect.height / 2 - svgRect.top) / currentZoom;

        currentLine.setAttribute('d', `M${startX} ${startY} L${startX} ${startY}`);
    }

    // --- 删除连接 ---
    function removeConnection(index) {
        connections.splice(index, 1); // 从数组中移除连接
        renderConnections(); // 重新渲染所有连接
    }

    // --- 加载模块数据和参数定义 ---
    async function initializeData() {
        console.log('Attempting to load modules.json and modules_parameter.json...');
        try {
            const [modulesResponse, paramsResponse] = await Promise.all([
                fetch(`${basePath}/data/modules.json`),
                fetch(`${basePath}/data/modules_parameter.json`)
            ]);

            if (!modulesResponse.ok) {
                throw new Error(`HTTP error! status: ${modulesResponse.status} for modules.json`);
            }
            if (!paramsResponse.ok) {
                throw new Error(`HTTP error! status: ${paramsResponse.status} for modules_parameter.json`);
            }

            availableModules = await modulesResponse.json();
            availableModuleParameters = await paramsResponse.json();

            console.log('Loaded modules:', availableModules);
            console.log('Loaded module parameters:', availableModuleParameters);

            renderModulesPalette();
        } catch (error) {
            console.error('Error initializing data:', error);
            modulesPalette.innerHTML = '<p>加载数据失败，请确保 modules.json 和 modules_parameter.json 文件存在且可访问。</p>';
        }
    }

    // --- 渲染左侧模块列表 ---
    function renderModulesPalette() {
        modulesPalette.innerHTML = '';
        if (availableModules.length === 0) {
            modulesPalette.innerHTML = '<p>没有可用的模块。</p>';
            console.warn('availableModules is empty, no modules rendered.');
            return;
        }
        availableModules.forEach(module => {
            const moduleDiv = document.createElement('div');
            moduleDiv.classList.add('module-item');
            moduleDiv.setAttribute('draggable', 'true');
            moduleDiv.dataset.moduleName = module.moduleName;
            moduleDiv.textContent = module.moduleName; // 显示模块名称
            modulesPalette.appendChild(moduleDiv);

            moduleDiv.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', module.moduleName);
            });
        });
        console.log('Modules palette rendered with', availableModules.length, 'modules.');
    }

    // --- 流程画布拖放逻辑 ---
    flowCanvas.addEventListener('dragover', (e) => {
        e.preventDefault(); // 允许放置
    });

    flowCanvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const moduleName = e.dataTransfer.getData('text/plain');
        if (moduleName) {
            const moduleData = availableModules.find(m => m.moduleName === moduleName);
            if (moduleData) {
                // 计算放置位置相对于 flowCanvasInner 的坐标，考虑滚动
                const flowCanvasRect = flowCanvas.getBoundingClientRect();
                const x = (e.clientX - flowCanvasRect.left + flowCanvas.scrollLeft) / currentZoom;
                const y = (e.clientY - flowCanvasRect.top + flowCanvas.scrollTop) / currentZoom;
                addNodeToCanvas(moduleData, x, y);
            }
        }
    });

    // --- 添加节点到画布 ---
    function addNodeToCanvas(moduleData, clientX, clientY) {
        // 对 moduleData 进行深拷贝，确保每个节点实例都有独立的 input 和 gotoModule
        const newNode = JSON.parse(JSON.stringify(moduleData));
        newNode.moduleUIName = generateUniqueUIName(moduleData.moduleName);
        newNode.id = newNode.moduleUIName; // 使用 moduleUIName 作为 DOM ID
        
        // 计算节点放置位置，考虑滚动和缩放
        const flowCanvasRect = flowCanvas.getBoundingClientRect();
        newNode.x = (clientX - flowCanvasRect.left + flowCanvas.scrollLeft) / currentZoom;
        newNode.y = (clientY - flowCanvasRect.top + flowCanvas.scrollTop) / currentZoom;

        flowNodes.push(newNode);
        renderFlowNodes();
        selectNode(newNode.id);
    }

    // --- 生成唯一的 moduleUIName ---
    function generateUniqueUIName(baseName) {
        let uniqueName = `${baseName}_${nextModuleId}`;
        while (flowNodes.some(node => node.moduleUIName === uniqueName)) {
            nextModuleId++;
            uniqueName = `${baseName}_${nextModuleId}`;
        }
        nextModuleId++;
        return uniqueName;
    }

    // --- 渲染画布上的所有节点 ---
    function renderFlowNodes() {
        // 先清除所有非 SVG 的节点
        flowCanvasInner.querySelectorAll('.flow-node').forEach(node => node.remove());
        // SVG 线条由 renderConnections 管理，此处不清除

        flowNodes.forEach(node => {
            const nodeDiv = document.createElement('div');
            nodeDiv.classList.add('flow-node');
            nodeDiv.id = node.id;
            nodeDiv.style.left = `${node.x}px`;
            nodeDiv.style.top = `${node.y}px`;
            nodeDiv.textContent = node.moduleUIName; // 显示唯一的UI名称

            // 添加删除按钮
            const closeButton = document.createElement('button');
            closeButton.classList.add('close-button');
            closeButton.textContent = 'x';
            closeButton.title = '删除模块';
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡到节点拖拽
                removeNode(node.id);
            });
            nodeDiv.appendChild(closeButton);

            // 添加输入锚点
            const inputAnchor = document.createElement('div');
            inputAnchor.classList.add('handle', 'input-anchor');
            inputAnchor.dataset.nodeId = node.id;
            inputAnchor.dataset.handleType = 'input'; // 标记为输入锚点
            nodeDiv.appendChild(inputAnchor);

            // 添加 output-0 (代表 case0) 和 output-others 锚点
            const handle0 = document.createElement('div');
            handle0.classList.add('handle', 'output-0');
            handle0.dataset.nodeId = node.id;
            handle0.dataset.handleType = '0'; // '0' represents case0 for condition modules
            nodeDiv.appendChild(handle0);

            const handleOthers = document.createElement('div');
            handleOthers.classList.add('handle', 'output-others');
            handleOthers.dataset.nodeId = node.id;
            handleOthers.dataset.handleType = 'others';
            nodeDiv.appendChild(handleOthers);
            

            flowCanvasInner.appendChild(nodeDiv); // 将节点附加到 flowCanvasInner

            nodeDiv.addEventListener('mousedown', (e) => {
                // 如果点击的是输出锚点，开始绘制连接线
                if (e.target.classList.contains('handle') && (e.target.classList.contains('output-0') || e.target.classList.contains('output-others') || e.target.classList.contains('output-case'))) {
                    startDrawingConnection(e.target);
                    return;
                }
                // 否则，开始拖拽节点
                isDraggingNode = true;
                selectedNode = node;
                dragOffsetX = e.clientX - nodeDiv.getBoundingClientRect().left;
                dragOffsetY = e.clientY - nodeDiv.getBoundingClientRect().top;
                selectNode(node.id);
            });
        });
        renderConnections(); // 重新渲染连接线
    }

    // --- 删除节点 ---
    function removeNode(nodeId) {
        flowNodes = flowNodes.filter(node => node.id !== nodeId);
        // 移除所有与该节点相关的连接
        connections = connections.filter(conn => conn.startNodeId !== nodeId && conn.endNodeId !== nodeId);

        renderFlowNodes(); // 重新渲染所有节点和连接线
        if (selectedNode && selectedNode.id === nodeId) {
            selectedNode = null;
            moduleDetails.innerHTML = '<p>点击画布上的模块查看详情。</p>';
        }
    }

    // --- 选中节点 ---
    function selectNode(nodeId) {
        flowCanvas.querySelectorAll('.flow-node').forEach(nodeDiv => {
            nodeDiv.classList.remove('selected');
        });
        const nodeDiv = document.getElementById(nodeId);
        if (nodeDiv) {
            nodeDiv.classList.add('selected');
            selectedNode = flowNodes.find(node => node.id === nodeId);
            displayModuleDetails(selectedNode);
        } else {
            selectedNode = null;
            moduleDetails.innerHTML = '<p>点击画布上的模块查看详情。</p>';
        }
    }

    // --- 显示模块详情 ---
    function displayModuleDetails(module) {
        moduleDetails.innerHTML = `
            <h3>${module.moduleUIName}</h3>
            <label for="detail-moduleUIName">模块UI名称:</label>
            <input type="text" id="detail-moduleUIName" value="${module.moduleUIName}">

            <label for="detail-moduleName">模块名称:</label>
            <input type="text" id="detail-moduleName" value="${module.moduleName}" disabled>

            <label for="detail-description">描述:</label>
            <textarea id="detail-description" disabled>${module.description || ''}</textarea>

            <label>输入 (Input):</label>
            <div id="detail-input-editor" class="input-editor">
                <!-- Input 字段动态生成 -->
            </div>
            <button id="update-module-details">更新模块</button>
        `;

        document.getElementById('detail-moduleUIName').addEventListener('change', (e) => {
            module.moduleUIName = e.target.value;
            // 更新节点的id，因为id是moduleUIName
            const nodeDiv = document.getElementById(selectedNode.id);
            if (nodeDiv) {
                nodeDiv.id = e.target.value;
            }
            selectedNode.id = e.target.value; // 更新数据模型中的id
            renderFlowNodes(); // 重新渲染以更新显示
        });
        // moduleName 和 description 现在是 disabled，无需监听 change 事件
        // document.getElementById('detail-moduleName').addEventListener('change', (e) => {
        //     module.moduleName = e.target.value;
        //     renderFlowNodes(); // 更新画布上的显示
        // });
        // document.getElementById('detail-description').addEventListener('change', (e) => {
        //     module.description = e.target.value;
        // });

        const inputEditor = document.getElementById('detail-input-editor');
        renderInputEditor(module, inputEditor);

        document.getElementById('update-module-details').addEventListener('click', () => {
            // 重新渲染以确保所有更改都反映在 UI 和数据中
            renderFlowNodes();
            alert('模块详情已更新！');
        });
    }

    // --- 渲染 Input 编辑器 ---
    function renderInputEditor(module, container) {
        container.innerHTML = '';
        if (module.moduleName === 'condition') {
            renderConditionInput(module, container);
        } else {
            // 查找模块的参数定义
            const moduleParamDef = availableModuleParameters.find(mp => mp.moduleName === module.moduleName);

            if (moduleParamDef && moduleParamDef.input) {
                // 遍历参数定义并渲染 UI
                for (const key in moduleParamDef.input) {
                    // 忽略特殊字段，如注释
                    if (key.startsWith('_')) continue;

                    const paramDef = moduleParamDef.input[key];
                    const currentValue = module.input[key]; // 获取当前模块实例中的值

                    // 如果 module.input 中没有该参数，则使用参数定义中的 default 值
                    if (module.input[key] === undefined && paramDef.default !== undefined) {
                        module.input[key] = paramDef.default;
                    }

                    renderParameterInput(key, paramDef, module.input, container, 0, module); // 渲染参数输入，传递 module 对象
                }
            } else {
                // 如果没有找到参数定义，则渲染通用的文本输入框（与之前行为类似）
                for (const key in module.input) {
                    if (key.startsWith('_') || key.startsWith('+')) continue; // 忽略特殊字段
                    const label = document.createElement('label');
                    label.textContent = key + ':';
                    container.appendChild(label);

                    const input = document.createElement('input');
                    input.type = 'text';
                    input.id = `input-${key}`;
                    input.value = module.input[key];
                    input.addEventListener('change', (e) => {
                        module.input[key] = e.target.value;
                    });
                    container.appendChild(input);
                }
            }
        }
    }

    // --- 递归渲染参数输入 UI ---
    // paramKey: 参数的键名
    // paramDef: 参数的定义对象 (来自 modules_parameter.json)
    // dataObject: 存储参数值的对象 (module.input)
    // parentContainer: 渲染到的父容器
    // depth: 当前递归深度，用于缩进
    // currentModule: 当前正在编辑的模块对象 (用于特殊逻辑判断)
    function renderParameterInput(paramKey, paramDef, dataObject, parentContainer, depth, currentModule) {
        // 忽略以 "_" 开头的注释字段
        if (paramKey.startsWith('_')) return;

        const wrapperDiv = document.createElement('div');
        wrapperDiv.classList.add('param-input-wrapper');
        wrapperDiv.style.marginLeft = `${depth * 15}px`;
        parentContainer.appendChild(wrapperDiv);

        const label = document.createElement('label');
        label.textContent = paramKey + ':';
        wrapperDiv.appendChild(label);

        // 特殊处理：checkBatteryHealth 模块的 iOSParam.customize 和 refurbish 模块的 customizeIpsw.customizeIpsw
        const isSpecialJsonTextarea = (
            (currentModule && currentModule.moduleName === 'checkBatteryHealth' && paramKey === 'customize' && dataObject === currentModule.input.iOSParam) ||
            (currentModule && currentModule.moduleName === 'refurbish' && paramKey === 'customizeIpsw' && dataObject === currentModule.input.customizeIpsw)
        );

        if (isSpecialJsonTextarea) {
            const textarea = document.createElement('textarea');
            textarea.rows = 5;
            // 确保值为对象，以便 JSON.stringify
            let jsonValue = dataObject[paramKey];
            if (jsonValue === undefined || jsonValue === null) {
                jsonValue = {};
                dataObject[paramKey] = jsonValue; // 初始化到数据模型中
            }
            textarea.value = JSON.stringify(jsonValue, null, 2); // 格式化显示 JSON 字符串
            textarea.addEventListener('change', (e) => {
                try {
                    dataObject[paramKey] = JSON.parse(e.target.value);
                    textarea.classList.remove('error');
                } catch (error) {
                    console.error("Invalid JSON input:", error);
                    textarea.classList.add('error');
                    // 可以考虑在这里添加视觉反馈，例如边框变红
                }
                updateModuleDetailsAndRender();
            });
            wrapperDiv.appendChild(textarea);
        } else if (paramDef.type === 'Text') {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = dataObject[paramKey] !== undefined ? dataObject[paramKey] : (paramDef.default !== undefined ? paramDef.default : '');
            input.addEventListener('change', (e) => {
                dataObject[paramKey] = e.target.value;
                updateModuleDetailsAndRender();
            });
            wrapperDiv.appendChild(input);
        } else if (paramDef.type === 'Select') {
            const select = document.createElement('select');
            paramDef.option.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                if (dataObject[paramKey] === opt.value || (dataObject[paramKey] === undefined && paramDef.default === opt.value)) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            select.addEventListener('change', (e) => {
                dataObject[paramKey] = e.target.value;
                updateModuleDetailsAndRender();
            });
            wrapperDiv.appendChild(select);
        } else if (typeof paramDef === 'object' && paramDef !== null && !Array.isArray(paramDef)) {
            // 如果是嵌套对象，递归渲染
            // 确保 dataObject 中有对应的子对象
            if (dataObject[paramKey] === undefined || typeof dataObject[paramKey] !== 'object' || Array.isArray(dataObject[paramKey])) {
                dataObject[paramKey] = {};
            }
            for (const subKey in paramDef) {
                // 忽略以 "_" 开头的注释字段
                if (subKey.startsWith('_')) continue;

                renderParameterInput(subKey, paramDef[subKey], dataObject[paramKey], wrapperDiv, depth + 1, currentModule); // 传递 currentModule
            }
        } else {
            // 默认渲染为文本框，以防未知类型或未定义的参数结构
            const input = document.createElement('input');
            input.type = 'text';
            input.value = dataObject[paramKey] !== undefined ? dataObject[paramKey] : '';
            input.addEventListener('change', (e) => {
                dataObject[paramKey] = e.target.value;
                updateModuleDetailsAndRender();
            });
            wrapperDiv.appendChild(input);
        }
    }

    // --- 渲染 condition 模块的 Input 编辑器 ---
    function renderConditionInput(module, container) {
        // 初始化 module.input.conditions 为对象结构
        if (!module.input) module.input = {};
        if (!module.input.conditions || typeof module.input.conditions !== 'object' || Array.isArray(module.input.conditions)) {
            module.input.conditions = { case0: { op: "", items: [] } };
        } else if (!module.input.conditions.case0 || typeof module.input.conditions.case0 !== 'object' || Array.isArray(module.input.conditions.case0)) {
            module.input.conditions.case0 = { op: "", items: [] };
        }

        const case0 = module.input.conditions.case0;

        container.innerHTML = `
            <div class="condition-input-form">
                <h4>条件表达式 (Case 0)</h4>
                <div id="case0-logic-editor"></div>
            </div>
        `;

        const logicEditor = document.getElementById('case0-logic-editor');
        renderConditionLogic(case0, logicEditor, 0); // 渲染第一层逻辑，深度为0
    }

    // --- 递归渲染条件逻辑 ---
    // conditionObject: 当前层级的条件对象 (例如: { op: "AND", items: [...] } 或 { op: "EQ", field: "a", value: "1" })
    // parentContainer: 当前层级要渲染到的 DOM 容器
    // depth: 当前递归的深度，用于限制层级和调整 UI
    function renderConditionLogic(conditionObject, parentContainer, depth) {
        if (depth > 2) return; // 最多支持3层嵌套 (0, 1, 2)

        const levelDiv = document.createElement('div');
        levelDiv.classList.add('condition-logic-level');
        levelDiv.style.marginLeft = `${depth * 20}px`; // 根据深度增加缩进
        parentContainer.appendChild(levelDiv);

        // 如果是操作符 (AND/OR/NOT)
        if (conditionObject.op && conditionObject.items !== undefined) {
            levelDiv.innerHTML += `
                <select class="logic-op">
                    <option value="AND" ${conditionObject.op === 'AND' ? 'selected' : ''}>AND</option>
                    <option value="OR" ${conditionObject.op === 'OR' ? 'selected' : ''}>OR</option>
                    <option value="NOT" ${conditionObject.op === 'NOT' ? 'selected' : ''}>NOT</option>
                </select>
                <button class="add-condition-item">添加子条件</button>
            `;

            const opSelect = levelDiv.querySelector('.logic-op');
            opSelect.addEventListener('change', (e) => {
                conditionObject.op = e.target.value;
                // 如果切换到 NOT，清空 items (NOT 只有一个子项)
                if (conditionObject.op === 'NOT' && conditionObject.items.length > 1) {
                    conditionObject.items = [conditionObject.items[0]];
                }
                updateModuleDetailsAndRender();
            });

            levelDiv.querySelector('.add-condition-item').addEventListener('click', () => {
                if (conditionObject.op === 'NOT' && conditionObject.items.length >= 1) return; // NOT 只能有一个子项
                conditionObject.items.push({ op: 'EQ', field: '', value: '' }); // 默认添加一个简单的比较条件
                updateModuleDetailsAndRender();
            });

            // 渲染子条件
            const itemsContainer = document.createElement('div');
            itemsContainer.classList.add('condition-items-container');
            levelDiv.appendChild(itemsContainer);

            conditionObject.items.forEach((item, index) => {
                renderConditionLogic(item, itemsContainer, depth + 1);
            });

        } else { // 如果是简单的比较条件 (EQ, NEQ, GT, LT 等)
            levelDiv.innerHTML += `
                <select class="compare-op">
                    <option value="EQ" ${conditionObject.op === 'EQ' ? 'selected' : ''}>等于 (EQ)</option>
                    <option value="NEQ" ${conditionObject.op === 'NEQ' ? 'selected' : ''}>不等于 (NEQ)</option>
                    <option value="GT" ${conditionObject.op === 'GT' ? 'selected' : ''}>大于 (GT)</option>
                    <option value="LT" ${conditionObject.op === 'LT' ? 'selected' : ''}>小于 (LT)</option>
                    <option value="AND" ${conditionObject.op === 'AND' ? 'selected' : ''}>AND (嵌套)</option>
                    <option value="OR" ${conditionObject.op === 'OR' ? 'selected' : ''}>OR (嵌套)</option>
                    <option value="NOT" ${conditionObject.op === 'NOT' ? 'selected' : ''}>NOT (嵌套)</option>
                </select>
                <input type="text" class="field-input" value="${conditionObject.field || ''}" placeholder="字段">
                <input type="text" class="value-input" value="${conditionObject.value || ''}" placeholder="值">
                <button class="remove-condition-item">删除</button>
            `;

            const compareOpSelect = levelDiv.querySelector('.compare-op');
            compareOpSelect.addEventListener('change', (e) => {
                conditionObject.op = e.target.value;
                // 如果切换到 AND/OR/NOT，需要改变结构
                if (['AND', 'OR', 'NOT'].includes(conditionObject.op)) {
                    conditionObject.items = conditionObject.items || [{ op: 'EQ', field: '', value: '' }]; // 默认添加一个子项
                    delete conditionObject.field;
                    delete conditionObject.value;
                } else {
                    delete conditionObject.items;
                    conditionObject.field = conditionObject.field || '';
                    conditionObject.value = conditionObject.value || '';
                }
                updateModuleDetailsAndRender();
            });

            levelDiv.querySelector('.field-input').addEventListener('change', (e) => {
                conditionObject.field = e.target.value;
                updateModuleDetailsAndRender();
            });
            levelDiv.querySelector('.value-input').addEventListener('change', (e) => {
                conditionObject.value = e.target.value;
                updateModuleDetailsAndRender();
            });
            levelDiv.querySelector('.remove-condition-item').addEventListener('click', () => {
                // 从父级的 items 数组中移除自身
                const parentItems = parentContainer.parentNode.conditionObject.items;
                const index = parentItems.indexOf(conditionObject);
                if (index > -1) {
                    parentItems.splice(index, 1);
                }
                updateModuleDetailsAndRender();
            });
        }
    }

    // 辅助函数：更新模块详情并重新渲染（用于触发 UI 更新）
    function updateModuleDetailsAndRender() {
        if (selectedNode) {
            displayModuleDetails(selectedNode);
        }
        renderFlowNodes(); // 这会重新渲染所有节点和连接
    }




    // --- 鼠标移动拖拽节点 ---
    flowCanvas.addEventListener('mousemove', (e) => {
        if (isDraggingNode && selectedNode) {
            // 计算新的位置，考虑缩放和滚动
            const newX = (e.clientX - flowCanvas.getBoundingClientRect().left + flowCanvas.scrollLeft - dragOffsetX) / currentZoom;
            const newY = (e.clientY - flowCanvas.getBoundingClientRect().top + flowCanvas.scrollTop - dragOffsetY) / currentZoom;
            selectedNode.x = newX;
            selectedNode.y = newY;
            const nodeDiv = document.getElementById(selectedNode.id);
            if (nodeDiv) {
                nodeDiv.style.left = `${newX}px`;
                nodeDiv.style.top = `${newY}px`;
                updateConnections(selectedNode.id); // 更新相关连接线
            }
        } else if (isDrawingConnection && currentLine) {
            const { x, y } = getSvgCoordinates(e.clientX, e.clientY);
            drawConnectionLine(currentLine, startNodeId, startHandleType, { x, y });
        }
    });

    // --- 鼠标抬起结束拖拽或连接 ---
    flowCanvas.addEventListener('mouseup', (e) => {
        isDraggingNode = false;
        if (isDrawingConnection) {
            const targetNodeDiv = e.target.closest('.flow-node'); // 查找是否落在任何一个流节点上
            if (targetNodeDiv) {
                const targetInputAnchor = targetNodeDiv.querySelector('.handle.input-anchor');
                if (targetInputAnchor) {
                    const targetNodeId = targetNodeDiv.id;
                    // 确保不会连接到自身
                    if (targetNodeId !== startNodeId) {
                        // 检查是否已经存在相同的连接
                        const existingConnection = connections.find(conn =>
                            conn.startNodeId === startNodeId &&
                            conn.startHandleType === startHandleType &&
                            conn.endNodeId === targetNodeId
                        );
                        if (!existingConnection) {
                            connections.push({
                                startNodeId: startNodeId,
                                startHandleType: startHandleType,
                                endNodeId: targetNodeId
                            });
                        }
                    }
                }
            }
            // 无论是否成功连接，都移除临时绘制的连接线
            if (currentLine) {
                currentLine.remove();
            }

            currentLine = null;
            isDrawingConnection = false;
            startNodeId = null;
            startHandleType = null;
            renderConnections(); // 重新渲染所有连接线
        }
    });

    // --- 加载流程按钮点击事件 ---
    loadFlowButton.addEventListener('click', () => {
        loadFlowInput.click(); // 触发文件输入框点击
    });

    // --- 文件输入框变化事件 (选择文件后) ---
    loadFlowInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const flowData = JSON.parse(e.target.result);
                loadFlowFromJson(flowData);
            } catch (error) {
                console.error('Error parsing JSON file:', error);
                alert('加载流程失败：文件内容不是有效的 JSON 格式。');
            }
        };
        reader.readAsText(file);
    });

    // --- 从 JSON 数据加载流程图 ---
    function loadFlowFromJson(flowData) {
        // 清空当前画布上的所有节点和连接
        flowNodes = [];
        connections = [];
        nextModuleId = 1; // 重置 ID 生成器

        // 遍历 flowData.modules，重新构建 flowNodes
        flowData.modules.forEach(moduleData => {
            // 确保 moduleData 中有 moduleUIName，否则生成一个
            if (!moduleData.moduleUIName) {
                moduleData.moduleUIName = generateUniqueUIName(moduleData.moduleName);
            }
            moduleData.id = moduleData.moduleUIName; // 使用 moduleUIName 作为 DOM ID

            // 简单的布局，可以根据需要调整，例如从 JSON 中读取位置信息
            // 如果 JSON 中没有 x, y，则给一个默认值
            if (moduleData.x === undefined) moduleData.x = 50 + Math.random() * 200; 
            if (moduleData.y === undefined) moduleData.y = 50 + Math.random() * 200; 
            
            flowNodes.push(moduleData);

            // 根据 gotoModule 构建 connections
            for (const handleType in moduleData.gotoModule) {
                const targetModuleUIName = moduleData.gotoModule[handleType];
                if (targetModuleUIName) {
                    // 画布输出锚点使用 output-0 / output-others；condition JSON 里是 case0。
                    // 加载时统一归一化，确保历史数据可以正确渲染连线。
                    let normalizedHandleType = handleType;
                    if (handleType === 'case0') {
                        normalizedHandleType = '0';
                    }

                    connections.push({
                        startNodeId: moduleData.id,
                        startHandleType: normalizedHandleType,
                        endNodeId: targetModuleUIName
                    });
                }
            }
        });

        renderFlowNodes(); // 渲染所有节点
        renderConnections(); // 渲染所有连接线
        alert(`流程 '${flowData.flowName}' 加载成功！`);
    }


    // --- 缩放功能 ---
    zoomInButton.addEventListener('click', () => {
        if (currentZoom + zoomStep <= maxZoom) {
            currentZoom += zoomStep;
            flowCanvasInner.style.transform = `scale(${currentZoom})`; // 应用到 inner 容器
            renderConnections(); // 缩放后重新定位连接线
        }
    });

    zoomOutButton.addEventListener('click', () => {
        if (currentZoom - zoomStep >= minZoom) {
            currentZoom -= zoomStep;
            flowCanvasInner.style.transform = `scale(${currentZoom})`; // 应用到 inner 容器
            renderConnections(); // 缩放后重新定位连接线
        }
    });

    // --- 保存流程 ---
    saveFlowButton.addEventListener('click', async () => {
        const flowName = prompt('请输入流程名称:', 'Untitled Flow'); // 提供默认名称
        if (!flowName) return;

        // 1. 生成并下载 JSON 文件
        const savedFlow = {
            signature: 'generated-' + Date.now(),
            description: `${flowName} 流程`,
            flowName: flowName,
            flowEstimationTime: "3600", // 修改默认值为 3600
            flowFirstmodule: flowNodes.length > 0 ? flowNodes[0].moduleUIName : "",
            modules: []
        };

        flowNodes.forEach(node => {
            const moduleToSave = { ...node };
            // 清理临时属性
            delete moduleToSave.id;
            // 保留 x, y 坐标，用于加载时还原位置
            // delete moduleToSave.x;
            // delete moduleToSave.y;
            delete moduleToSave.dataset; // 移除 dataset，因为它不是原始JSON的一部分

            // 如果是 condition 模块，处理其 input.conditions 和 gotoModule
            if (node.moduleName === 'condition') {
                if (!moduleToSave.input || typeof moduleToSave.input !== 'object') {
                    moduleToSave.input = {};
                }
                if (!node.input || typeof node.input !== 'object') {
                    node.input = {};
                }
                if (!node.input.conditions || typeof node.input.conditions !== 'object' || Array.isArray(node.input.conditions)) {
                    node.input.conditions = {};
                }

                // 当前编辑器只支持 case0，保存时强制只输出 case0
                moduleToSave.input.conditions = {
                    case0: node.input.conditions.case0 || { op: "", items: [] }
                };
                delete moduleToSave.input.condition;

                // 构建 gotoModule
                moduleToSave.gotoModule = {};

                // 处理 case0 的连接 (对应 output-0)
                const case0ConnectedTarget = connections.find(conn =>
                    conn.startNodeId === node.id && conn.startHandleType === '0'
                );
                moduleToSave.gotoModule['case0'] = case0ConnectedTarget ? case0ConnectedTarget.endNodeId : "";

                // 处理 others 的连接
                const othersConnectedTarget = connections.find(conn =>
                    conn.startNodeId === node.id && conn.startHandleType === 'others'
                );
                moduleToSave.gotoModule['others'] = othersConnectedTarget ? othersConnectedTarget.endNodeId : "";

            } else {
                // 对于其他模块，使用硬编码的 0 和 others 作为 gotoModule 的键
                moduleToSave.gotoModule = {
                    "0": "",
                    "others": ""
                };
                connections.forEach(conn => {
                    if (conn.startNodeId === node.id) {
                        moduleToSave.gotoModule[conn.startHandleType] = conn.endNodeId;
                    }
                });
                // 如果原始模块有 gotoModule，但没有连接，则保留原始的
                if (node.gotoModule && Object.keys(node.gotoModule).length > 0) {
                    if (Object.keys(moduleToSave.gotoModule).every(key => moduleToSave.gotoModule[key] === "")) {
                         moduleToSave.gotoModule = node.gotoModule;
                    }
                }
            }


            savedFlow.modules.push(moduleToSave);
        });

        const jsonString = JSON.stringify(savedFlow, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${flowName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // 2. 生成并下载截图
        try {
            // 暂时隐藏删除按钮，避免其出现在截图中
            document.querySelectorAll('.connection-delete-button, .connection-delete-text, .flow-node .close-button').forEach(el => {
                el.style.visibility = 'hidden';
            });

            // 捕获 flowCanvas 元素，包括 SVG
            const canvas = await html2canvas(flowCanvas, {
                useCORS: true, // 允许加载跨域图片（如果有的话）
                logging: false // 禁用日志
            });
            
            // 恢复删除按钮的可见性
            document.querySelectorAll('.connection-delete-button, .connection-delete-text, .flow-node .close-button').forEach(el => {
                el.style.visibility = 'visible';
            });

            const imgData = canvas.toDataURL('image/png');
            const imgA = document.createElement('a');
            imgA.href = imgData;
            imgA.download = `${flowName}.png`;
            document.body.appendChild(imgA);
            imgA.click();
            document.body.removeChild(imgA);
        } catch (error) {
            console.error('生成截图失败:', error);
            alert('生成截图失败！');
            // 确保即使截图失败，删除按钮的可见性也能恢复
            document.querySelectorAll('.connection-delete-button, .connection-delete-text, .flow-node .close-button').forEach(el => {
                el.style.visibility = 'visible';
            });
        }
    });

    // --- 初始化 ---
    initializeData();
});