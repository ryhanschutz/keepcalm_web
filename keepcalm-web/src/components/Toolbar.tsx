import {
  Copy,
  PlusCircle,
  RefreshCw,
  Search,
  Share2,
  Shield,
} from 'lucide-react';
import { KeyboardEvent, useEffect, useState } from 'react';
import { useTabStore } from '../store/useTabStore';
import { getAddressFieldValue } from '../utils/navigation';

interface ToolbarProps {
  onTogglePrivacyPanel?: () => void;
}

const Toolbar = ({ onTogglePrivacyPanel }: ToolbarProps) => {
  const tabs = useTabStore((state) => state.tabs);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const addTab = useTabStore((state) => state.addTab);
  const navigate = useTabStore((state) => state.navigate);
  const navigateBack = useTabStore((state) => state.navigateBack);
  const navigateForward = useTabStore((state) => state.navigateForward);
  const reloadActiveTab = useTabStore((state) => state.reloadActiveTab);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const [addressValue, setAddressValue] = useState('');

  useEffect(() => {
    if (!activeTab) {
      setAddressValue('');
      return;
    }

    setAddressValue(getAddressFieldValue(activeTab.url, activeTab.isInternal));
  }, [activeTab]);

  const submitNavigation = async () => {
    await navigate(addressValue);
  };

  const handleKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    await submitNavigation();
  };

  return (
    <div className="toolbar">
      <div className="toolbar-side toolbar-side-left">
        <button className="toolbar-inline-btn" type="button" onClick={() => void navigateBack()} aria-label="Back">
          <span className="toolbar-arrow toolbar-arrow-left" />
        </button>
        <button className="toolbar-inline-btn" type="button" onClick={() => void navigateForward()} aria-label="Forward">
          <span className="toolbar-arrow toolbar-arrow-right" />
        </button>
      </div>

      <div className="address-bar" role="group" aria-label="Address bar">
        <span className="address-icon">
          <Search size={14} />
        </span>
        <input
          type="text"
          value={addressValue}
          onChange={(event) => setAddressValue(event.target.value)}
          onKeyDown={(event) => void handleKeyDown(event)}
          onFocus={(event) => event.currentTarget.select()}
          className="address-input"
          placeholder="Search or enter website name"
          aria-label="Address"
        />
        <button className="address-refresh" type="button" onClick={() => void reloadActiveTab()} aria-label="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="toolbar-side toolbar-side-right">
        <button className="toolbar-inline-btn" type="button" onClick={onTogglePrivacyPanel} aria-label="Privacy panel">
          <Shield size={14} />
        </button>
        <button className="toolbar-inline-btn" type="button" onClick={() => void addTab()} aria-label="New tab">
          <PlusCircle size={15} />
        </button>
        <button className="toolbar-inline-btn" type="button" aria-label="Share">
          <Share2 size={15} />
        </button>
        <button className="toolbar-inline-btn" type="button" aria-label="Duplicate">
          <Copy size={15} />
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
