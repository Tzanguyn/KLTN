import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogOut, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleClearStorageAndLogout = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-xl w-full bg-slate-800/90 border border-rose-500/30 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="p-3 bg-rose-500/20 rounded-xl border border-rose-500/30">
                <ShieldAlert className="w-8 h-8 text-rose-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Đã xảy ra sự cố hiển thị</h2>
                <p className="text-xs text-rose-300/90">Giao diện gặp lỗi khi xử lý dữ liệu</p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-700/60 rounded-xl p-4 my-4 overflow-x-auto text-xs font-mono text-rose-200 leading-relaxed">
              <div className="font-bold text-rose-300 mb-1">Chi tiết lỗi:</div>
              {this.state.error?.message || 'Lỗi không xác định'}
            </div>

            {this.state.errorInfo?.componentStack && (
              <details className="text-xs text-slate-400 mb-6 cursor-pointer">
                <summary className="hover:text-slate-200 transition-colors font-medium">
                  Xem Stack Trace thành phần
                </summary>
                <pre className="mt-2 p-3 bg-slate-950 rounded-lg overflow-x-auto text-[11px] font-mono text-slate-400 max-h-40 leading-tight">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tải lại trang</span>
              </button>
              <button
                onClick={this.handleClearStorageAndLogout}
                className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Xóa Cache & Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

