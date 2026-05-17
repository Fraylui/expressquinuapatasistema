package com.expressvraem.modules.modulos.repository;

import com.expressvraem.modules.modulos.entity.UsuarioModulo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UsuarioModuloRepository extends JpaRepository<UsuarioModulo, Long> {

    List<UsuarioModulo> findByUsuarioIdAndActivoTrue(Long usuarioId);

    List<UsuarioModulo> findByUsuarioId(Long usuarioId);

    @Query("SELECT um FROM UsuarioModulo um WHERE um.usuarioId = :uid AND um.modulo.codigo = :codigo AND um.activo = true")
    Optional<UsuarioModulo> findActivoByUsuarioAndCodigo(@Param("uid") Long usuarioId, @Param("codigo") String codigo);

    @Modifying
    @Query("DELETE FROM UsuarioModulo um WHERE um.usuarioId = :uid")
    void deleteByUsuarioId(@Param("uid") Long usuarioId);
}
