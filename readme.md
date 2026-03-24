how to test:
1. run the server: python3 -m http.server
2. open the browser: http://localhost:8000

how to add new module:
1. add the module parameter in the modules_parameter.json file
2. add the module in the modules.json file

sample files:
1. Full_Flow.json - this is a sample flow file, create by the flow builder
2. Full_Flow.png - this is a sample flow image, create by the flow builder
3. full_modules.json - this is a sample modules file, create manully by RichardCao

保存流程：
1. 点击保存流程按钮
2. 输入流程名称
3. 点击确认保存
   a. 保存的JSON文件将包含流程的所有信息，包括模块、连接、参数等
   b. 保存的图片文件将包含流程的可视化展示

加载流程：
1. 点击加载流程按钮
2. 选择要加载的JSON文件
3. 点击确认加载
   a. 加载的JSON文件将包含流程的所有信息，包括模块、连接、参数等
   b. 加载的模块将在可视化展示中显示出来，但并不包含位置信息，请参考保存时的图片修正模块的位置