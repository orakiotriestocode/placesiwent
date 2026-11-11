from pathlib import Path
import json, zipfile, shutil
root = Path(__file__).resolve().parents[1]
archive = root / 'web-apps/downloads/quick-todo.zip'
tmp = root / '_todo_release_tmp'
if tmp.exists(): shutil.rmtree(tmp)
with zipfile.ZipFile(archive) as z:
    bad = z.testzip()
    if bad: raise RuntimeError(f'Invalid existing extension archive: {bad}')
    z.extractall(tmp)
folder = tmp / 'quick-todo-extension'
f = folder / 'popup.js'
s = f.read_text()
s = s.replace("let lastRevision = '';", "let lastRevision = '';\nlet editingTaskId = null;\nlet savingInFlight = false;")
s = s.replace("  await chrome.storage.sync.set({[SYNC_KEY]:{count:chunks.length, rev}});\n  lastRevision = rev;", "  lastRevision = rev;\n  await chrome.storage.sync.set({[SYNC_KEY]:{count:chunks.length, rev}});")
s = s.replace("  saving = saving.catch(()=>{}).then(async()=>{\n    try {", "  saving = saving.catch(()=>{}).then(async()=>{\n    savingInFlight = true;\n    try {")
s = s.replace("      // Retain local backup, and retry on a subsequent edit.\n    }\n  });", "      // Retain local backup, and retry on a subsequent edit.\n    } finally { savingInFlight = false; }\n  });")
s = s.replace("if (!rev || rev === lastRevision || dirty) return;", "if (!rev || rev === lastRevision || dirty || savingInFlight || editingTaskId) return;")
s = s.replace("if (dirty) return;\n    try {", "if (dirty || savingInFlight || editingTaskId) return;\n    try {")
s = s.replace("if (!remote || remote.rev === lastRevision || dirty) return;", "if (!remote || remote.rev === lastRevision || dirty || savingInFlight || editingTaskId) return;")
start = s.index("    const text = document.createElement('span');")
end = s.index("\n    const del = document.createElement('button');", start)
new = """    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = task.text;
    text.title = 'Double-click to edit';
    function startEditing() {
      if (editingTaskId) return;
      editingTaskId = task.id;
      li.draggable = false;
      const editor = document.createElement('input');
      editor.type = 'text';
      editor.className = 'task-editor';
      editor.maxLength = 240;
      editor.value = task.text;
      editor.setAttribute('aria-label', `Edit ${task.text}`);
      text.replaceWith(editor);
      let finished = false;
      const finish = (cancel = false) => {
        if (finished) return;
        finished = true;
        const changedText = editor.value.trim().slice(0, 240);
        editingTaskId = null;
        if (!cancel && changedText && changedText !== task.text) {
          task.text = changedText;
          save();
        }
        render();
      };
      editor.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); finish(); }
        if (e.key === 'Escape') { e.preventDefault(); finish(true); }
      });
      editor.addEventListener('blur', () => finish());
      editor.focus();
      editor.select();
    }
    text.addEventListener('dblclick', startEditing);
    const edit = document.createElement('button');
    edit.className = 'task-edit';
    edit.type = 'button';
    edit.textContent = '✎';
    edit.title = 'Edit task';
    edit.setAttribute('aria-label', `Edit ${task.text}`);
    edit.addEventListener('click', startEditing);
"""
s = s[:start] + new + s[end:]
s = s.replace("    li.append(checkbox, text, del, handle);", "    li.append(checkbox, text, edit, del, handle);")
if "editingTaskId = task.id" not in s: raise RuntimeError("Edit patch missing")
f.write_text(s)
css = folder / 'popup.css'
css.write_text(css.read_text() + """
/* v1.3 compact inline editing */
.task-edit { border:0; background:transparent; color:#9acbb9; padding:3px; cursor:pointer; font-size:16px; flex:0 0 auto; }
.task-edit:hover { color:#c4f9e1; }
.task-editor { min-width:0; width:100%; flex:1; border:1px solid #90dbbb; background:#111c24; color:#fff; border-radius:5px; padding:4px 6px; font:inherit; font-size:12px; outline:2px solid #90dbbb33; }
""")
manifest = folder / 'manifest.json'
data = json.loads(manifest.read_text())
data['version'] = '1.3.0'
manifest.write_text(json.dumps(data, indent=2) + '\n')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p in folder.rglob('*'):
        if p.is_file(): z.write(p, p.relative_to(folder.parent))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
site = root / 'web-apps/index.html'
site.write_text(site.read_text().replace('>v1.2</small>', '>v1.3</small>'))
shutil.rmtree(tmp)
print('Generated Quick To-Do v1.3 ZIP')
