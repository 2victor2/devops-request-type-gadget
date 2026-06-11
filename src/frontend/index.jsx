import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text,
  Heading,
  Strong,
  Box,
  Stack,
  Inline,
  Lozenge,
  Spinner,
  SectionMessage,
  DynamicTable,
  Form,
  FormSection,
  FormFooter,
  Label,
  Textfield,
  Select,
  Checkbox,
  Button,
  HelperMessage,
  useConfig,
  useProductContext,
} from '@forge/react';
import { invoke, view } from '@forge/bridge';
import {
  SORT_OPTIONS,
  defaultFlatConfig,
  normalizeConfig,
} from '../constants.js';

// ---------------------------------------------------------------------------
// VIEW — summary + per-request-type breakdown table
// ---------------------------------------------------------------------------

const Summary = ({ totals }) => (
  <Box
    padding="space.200"
    backgroundColor="color.background.neutral"
    xcss={{ borderRadius: 'border.radius.200' }}
  >
    <Stack space="space.050">
      <Text size="small">
        <Strong>Work by request type</Strong>
      </Text>
      <Inline space="space.150" alignBlock="center">
        <Heading size="large">{totals.ticketCount}</Heading>
        <Text size="small">
          {totals.ticketCount === 1 ? 'issue' : 'issues'} across{' '}
          {totals.typeCount}{' '}
          {totals.typeCount === 1 ? 'request type' : 'request types'}
        </Text>
      </Inline>
    </Stack>
  </Box>
);

const BreakdownTable = ({ rows, showShare }) => {
  const cells = [
    { key: 'requestType', content: 'Request type', isSortable: true },
    { key: 'count', content: 'Count', isSortable: true },
  ];
  if (showShare) cells.push({ key: 'share', content: 'Share', isSortable: true });

  const head = { cells };

  const tableRows = rows.map((r) => {
    const rowCells = [
      { key: 'requestType', content: r.requestType },
      { key: 'count', content: String(r.count) },
    ];
    if (showShare) {
      rowCells.push({
        key: 'share',
        content: <Lozenge appearance="inprogress">{r.share}%</Lozenge>,
      });
    }
    return { key: r.key, cells: rowCells };
  });

  return (
    <DynamicTable
      head={head}
      rows={tableRows}
      rowsPerPage={rows.length > 12 ? 12 : undefined}
      emptyView="No issues in the source filter."
    />
  );
};

const View = () => {
  const config = useConfig() || {};
  const cfg = normalizeConfig(config);
  const [state, setState] = useState({ loading: true });

  // Re-fetch whenever the saved config changes, so edits take effect with no
  // redeploy. JSON key keeps the effect from firing on every render.
  const configKey = JSON.stringify(config);

  useEffect(() => {
    let active = true;
    setState({ loading: true });
    invoke('getBreakdown', { config })
      .then((res) => active && setState({ loading: false, res }))
      .catch(
        (err) =>
          active && setState({ loading: false, res: { ok: false, error: String(err) } }),
      );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  const { loading, res } = state;

  return (
    <Stack space="space.200">
      {loading && (
        <Inline space="space.100" alignBlock="center">
          <Spinner size="medium" />
          <Text>Loading request-type breakdown…</Text>
        </Inline>
      )}

      {!loading && res && !res.ok && (
        <SectionMessage title="Couldn't load breakdown" appearance="error">
          <Text>{res.error || 'Unknown error.'}</Text>
        </SectionMessage>
      )}

      {!loading && res && res.ok && res.rows.length === 0 && (
        <SectionMessage title="No work to show" appearance="information">
          <Text>There are no issues in the source filter right now.</Text>
        </SectionMessage>
      )}

      {!loading && res && res.ok && res.rows.length > 0 && (
        <Stack space="space.200">
          <Summary totals={res.totals} />
          <BreakdownTable rows={res.rows} showShare={cfg.showShare} />
        </Stack>
      )}
    </Stack>
  );
};

// ---------------------------------------------------------------------------
// EDIT — config form (source filter, sort, show-share)
// ---------------------------------------------------------------------------

const Edit = () => {
  const config = useConfig() || {};
  // Defaults first, saved config on top, so the form opens pre-filled and the
  // gadget works out of the box.
  const initial = { ...defaultFlatConfig(), ...normalizeConfig(config) };

  const [filterId, setFilterId] = useState(initial.filterId);
  const [sort, setSort] = useState(initial.sort);
  const [showShare, setShowShare] = useState(initial.showShare);

  const onSubmit = () => {
    view.submit({ filterId: String(filterId).trim(), sort, showShare });
  };

  const sortValue = SORT_OPTIONS.find((o) => o.value === sort) || SORT_OPTIONS[0];

  return (
    <Form onSubmit={onSubmit}>
      <FormSection>
        <Heading size="small">Source</Heading>
        <Label labelFor="filterId">Source filter id</Label>
        <Textfield
          id="filterId"
          value={filterId}
          onChange={(e) => setFilterId(e.target.value)}
        />
        <HelperMessage>
          Jira filter the gadget reads. Leave blank to use the SOURCE_FILTER_ID
          configured for the app.
        </HelperMessage>
      </FormSection>

      <FormSection>
        <Heading size="small">Display</Heading>
        <Label labelFor="sort">Sort by</Label>
        <Select
          id="sort"
          options={SORT_OPTIONS}
          value={sortValue}
          onChange={(opt) => setSort(opt ? opt.value : 'count')}
        />
        <Box paddingBlock="space.100">
          <Checkbox
            label="Show share (%) column"
            isChecked={showShare}
            onChange={(e) => setShowShare(e.target.checked)}
          />
        </Box>
      </FormSection>

      <FormFooter>
        <Button appearance="primary" type="submit">
          Save
        </Button>
      </FormFooter>
    </Form>
  );
};

// ---------------------------------------------------------------------------

const App = () => {
  const context = useProductContext();
  if (!context) return <Text>Loading…</Text>;
  return context.extension.entryPoint === 'edit' ? <Edit /> : <View />;
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
