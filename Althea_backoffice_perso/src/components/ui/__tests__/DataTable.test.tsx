import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DataTable, { Column } from '../DataTable'

interface Row {
  id: string
  name: string
  price: number
}

const columns: Column<Row>[] = [
  { key: 'name', label: 'Nom', sortable: true },
  { key: 'price', label: 'Prix', render: (row) => `${row.price} €` },
]

const rows: Row[] = [
  { id: '1', name: 'Alpha', price: 10 },
  { id: '2', name: 'Beta', price: 20 },
]

describe('<DataTable />', () => {
  it('affiche les données', () => {
    render(<DataTable columns={columns} data={rows} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('10 €')).toBeInTheDocument()
  })

  it('affiche le message vide quand data.length === 0', () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="Rien à afficher" />)
    expect(screen.getByText('Rien à afficher')).toBeInTheDocument()
  })

  it('affiche 5 squelettes en loading', () => {
    const { container } = render(<DataTable columns={columns} data={[]} isLoading />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(5 * columns.length)
  })

  it('appelle onSort quand on clique sur une colonne triable', async () => {
    const onSort = jest.fn()
    render(<DataTable columns={columns} data={rows} onSort={onSort} />)

    const sortBtn = screen.getByRole('button', { name: /Trier par Nom/i })
    await userEvent.click(sortBtn)
    expect(onSort).toHaveBeenCalledWith('name')
  })

  it('ne rend pas de bouton de tri pour les colonnes non triables', () => {
    render(<DataTable columns={columns} data={rows} />)
    expect(screen.queryByRole('button', { name: /Trier par Prix/i })).toBeNull()
  })

  it('appelle onRowClick au clic sur une ligne', async () => {
    const onRowClick = jest.fn()
    render(<DataTable columns={columns} data={rows} onRowClick={onRowClick} />)
    await userEvent.click(screen.getByText('Alpha'))
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })

  it('déclenche onRowClick sur Enter via clavier', () => {
    const onRowClick = jest.fn()
    render(<DataTable columns={columns} data={rows} onRowClick={onRowClick} />)
    const row = screen.getByText('Alpha').closest('tr')!
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })

  it('les lignes ne sont pas tabulables sans onRowClick', () => {
    render(<DataTable columns={columns} data={rows} />)
    const row = screen.getByText('Alpha').closest('tr')!
    expect(row).not.toHaveAttribute('tabindex')
  })
})
