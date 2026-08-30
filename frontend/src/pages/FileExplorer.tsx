import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { filesApi } from '../api/client'
import { useApp } from '../context/AppContext'
import { useDropzone } from 'react-dropzone'
import {
  FolderOpen, File, Upload, Zap, ChevronRight, Eye, AlertCircle,
  FileCode, Package, Settings, Loader, CheckCircle, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import AIChatPanel from '../components/AIChatPanel'
import PageHeader from '../components/PageHeader'

const LANG_COLORS: Record<string, string> = {
  java: '#f89820', javascript: '#f7df1e', typescript: '#3178c6',
  python: '#3776ab', csharp: '#9b4f96', go: '#00add8', rust: '#ce422b',
  php: '#8892bf', ruby: '#cc342d', kotlin: '#7f52ff', scala: '#dc322f',
  html: '#e34c26', css: '#1572b6', sql: '#e48e00', yaml: '#cb171e',
  xml: '#ff6600', json: '#000000', markdown: '#083fa1', bash: '#4eaa25',
  properties: '#aaaaaa',
}

function buildTree(files: any[]) {
  const tree: any = {}
  files.forEach(f => {
    const parts = f.path.split('/')
    let node = tree
    parts.forEach((p: string, i: number) => {
      if (!node[p]) node[p] = { __files__: [] }
      if (i === parts.length - 1) {
        node[p].__file__ = f
      } else {
        node = node[p]
      }
    })
  })
  return tree
}

function TreeNode({ name, node, depth, onSelect, selectedPath }: any) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = Object.keys(node).filter(k => k !== '__file__' && k !== '__files__').length > 0
  const file = node.__file__

  if (file) {
    const color = LANG_COLORS[file.language] || 'var(--text-muted)'
    return (
      <div
        className={`file-tree-item ${selectedPath === file.path ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => onSelect(file)}
      >
        <FileCode size={13} color={color} />
        <span style={{ flex: 1 }}>{name}</span>
        {file.language && <span style={{ fontSize: 10, color, opacity: 0.8 }}>{file.language}</span>}
        {!file.is_supported && (
          <span className="badge badge-neutral" style={{ fontSize: 9 }}>binary</span>
        )}
      </div>
    )
  }

  if (!hasChildren) return null

  return (
    <div>
      <div
        className="file-tree-item"
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => setOpen(o => !o)}
      >
        <ChevronRight size={13} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s' }} />
        <FolderOpen size={13} color="var(--warning)" />
        <span>{name}</span>
      </div>
      {open && Object.entries(node)
        .filter(([k]) => k !== '__file__' && k !== '__files__')
        .sort(([a, na]: any, [b, nb]: any) => {
          const aIsDir = !na.__file__
          const bIsDir = !nb.__file__
          if (aIsDir && !bIsDir) return -1
          if (!aIsDir && bIsDir) return 1
          return a.localeCompare(b)
        })
        .map(([k, v]) => (
          <TreeNode key={k} name={k} node={v} depth={depth + 1} onSelect={onSelect} selectedPath={selectedPath} />
        ))
      }
    </div>
  )
}

export default function FileExplorer() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { setCurrentProject } = useApp()
  const [files, setFiles] = useState<any[]>([])
  const [selectedFile, setSelectedFile] = useState<any>(null)
  const [fileContent, setFileContent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [loadingContent, setLoadingContent] = useState(false)

  const loadFiles = useCallback(async () => {
    if (!projectId) return
    const f = await filesApi.list(projectId)
    setFiles(f)
  }, [projectId])

  useEffect(() => {
    loadFiles().finally(() => setLoading(false))
  }, [loadFiles])

  const onDrop = useCallback(async (accepted: File[]) => {
    if (!projectId || !accepted.length) return
    setUploading(true)
    try {
      if (accepted.length === 1 && accepted[0].name.endsWith('.zip')) {
        await filesApi.uploadZip(projectId, accepted[0])
        toast.success('ZIP archive extracted and imported')
      } else {
        await filesApi.uploadFiles(projectId, accepted)
        toast.success(`${accepted.length} file(s) imported`)
      }
      await loadFiles()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [projectId, loadFiles])

  const loadDemo = async () => {
    if (!projectId) return
    setLoadingDemo(true)
    try {
      await filesApi.loadDemo(projectId)
      toast.success('Demo legacy project loaded! Ready for analysis.')
      await loadFiles()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to load demo')
    } finally {
      setLoadingDemo(false)
    }
  }

  const selectFile = async (file: any) => {
    setSelectedFile(file)
    if (!file.is_supported || file.is_binary) {
      setFileContent(null)
      return
    }
    setLoadingContent(true)
    try {
      const detail = await filesApi.get(projectId!, file.id)
      setFileContent(detail)
    } finally {
      setLoadingContent(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    noClick: false,
  })

  const tree = buildTree(files)
  const supported = files.filter(f => f.is_supported).length
  const binary = files.filter(f => f.is_binary).length

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      <PageHeader>
        <div>
          <h1>File Explorer</h1>
          {files.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              <span><CheckCircle size={11} color="var(--success)" style={{ verticalAlign: 'middle' }} /> {supported} files ready for analysis</span>
              {binary > 0 && <span><AlertCircle size={11} color="var(--warning)" style={{ verticalAlign: 'middle' }} /> {binary} binary files (excluded from analysis)</span>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-sm" onClick={() => navigate(`/projects/${projectId}/analysis`)}>
            <Zap size={13} />
            Analyze Project
          </button>
        </div>
      </PageHeader>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: file tree */}
        <div style={{
          width: 280,
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Upload zone */}
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
            <div
              {...getRootProps()}
              style={{
                border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 8,
                padding: '14px 12px',
                textAlign: 'center',
                cursor: 'pointer',
                background: isDragActive ? 'var(--accent-dim)' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--accent)', fontSize: 12 }}>
                  <span className="spinner" />Uploading...
                </div>
              ) : (
                <>
                  <Upload size={18} color="var(--text-muted)" style={{ marginBottom: 4 }} />
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Drop files or ZIP here
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>or click to browse</div>
                </>
              )}
            </div>
            <button
              className="btn btn-sm"
              style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
              onClick={loadDemo}
              disabled={loadingDemo}
            >
              {loadingDemo ? <span className="spinner" /> : <Zap size={13} />}
              {loadingDemo ? 'Loading...' : 'Load Demo Legacy Project'}
            </button>
          </div>

          {/* Tree */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {loading ? (
              <div className="loading-overlay"><span className="spinner" /></div>
            ) : files.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 12px' }}>
                <FolderOpen size={28} />
                <p style={{ fontSize: 12 }}>No files yet. Upload your legacy project above.</p>
              </div>
            ) : (
              Object.entries(tree)
                .sort(([a, na]: any, [b, nb]: any) => {
                  const aIsDir = !na.__file__
                  const bIsDir = !nb.__file__
                  if (aIsDir && !bIsDir) return -1
                  if (!aIsDir && bIsDir) return 1
                  return a.localeCompare(b)
                })
                .map(([k, v]) => (
                  <TreeNode key={k} name={k} node={v} depth={0} onSelect={selectFile} selectedPath={selectedFile?.path} />
                ))
            )}
          </div>
        </div>

        {/* Right: file preview */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {!selectedFile ? (
            <div className="empty-state">
              <FileCode size={40} />
              <h3>Select a File</h3>
              <p>Click a file in the tree to preview its contents.</p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 600 }}>{selectedFile.name}</h2>
                    {selectedFile.language && (
                      <span className="badge badge-info">{selectedFile.language}</span>
                    )}
                    {!selectedFile.is_supported && (
                      <span className="badge badge-neutral">Not analyzed</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedFile.path}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-sm"
                    onClick={() => navigate(`/projects/${projectId}/transform?file=${encodeURIComponent(selectedFile.path)}`)}
                  >
                    <Zap size={12} />
                    Transform
                  </button>
                </div>
              </div>

              {selectedFile.is_binary ? (
                <div className="alert alert-warning">
                  <AlertCircle size={16} />
                  <div>Binary file — cannot be displayed or analyzed directly. This file is excluded from AI analysis.</div>
                </div>
              ) : !selectedFile.is_supported ? (
                <div className="alert alert-info">
                  <AlertCircle size={16} />
                  <div>This file type is not supported for AI analysis but has been included in the project structure.</div>
                </div>
              ) : loadingContent ? (
                <div className="loading-overlay"><span className="spinner" /></div>
              ) : fileContent ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {fileContent.size_bytes ? `${(fileContent.size_bytes / 1024).toFixed(1)} KB` : ''}
                    </span>
                  </div>
                  <div className="code-block" style={{ maxHeight: 600, overflow: 'auto', lineHeight: 1.5 }}>
                    {fileContent.content}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <AIChatPanel
        contextFile={selectedFile?.path}
        contextType="file"
        suggestedQuestions={selectedFile ? [
          `What does ${selectedFile.name} do?`,
          `What are the main issues in ${selectedFile.name}?`,
          `How should ${selectedFile.name} be modernized?`,
        ] : []}
      />
    </div>
  )
}
